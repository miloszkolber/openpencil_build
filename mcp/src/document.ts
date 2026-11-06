import type { SceneGraph } from '@open-pencil/scene-graph'
import { collectSceneMutation } from '@open-pencil/scene-graph/mutation-impact'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import {
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  headlessRenderer,
  initCanvasKit
} from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts, installTextMeasurer, sizeAutoResizingText } from '@open-pencil/core/layout'
import { prepareGraphFonts } from '@open-pencil/core/text'
import { ALL_TOOLS, toolChangesDocument } from '@open-pencil/core/tools'

const io = new IORegistry(BUILTIN_IO_FORMATS)
let textMeasurer: Promise<Awaited<ReturnType<typeof headlessRenderer>>> | null = null

async function measureTextHeadlessly() {
  textMeasurer ??= (async () => {
    const renderer = await headlessRenderer()
    installTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth))
    return renderer
  })().catch((error: unknown) => {
    textMeasurer = null
    throw error
  })
  return textMeasurer
}

export async function measureDocumentText(graph: SceneGraph): Promise<void> {
  await measureTextHeadlessly()
  await prepareGraphFonts(
    graph,
    graph.getPages(true).map((page) => page.id)
  )
}

function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

export async function loadGraph(bytes: Uint8Array): Promise<SceneGraph> {
  const name = isZip(bytes) ? 'document.fig' : 'document.pen'
  const { graph } = await io.readDocument({
    name,
    data: bytes,
    readAsset: async () => null
  })
  if (name.endsWith('.fig')) populateAllFigPages(graph)
  graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
  await measureDocumentText(graph)
  return graph
}

export async function writeGraph(graph: SceneGraph): Promise<Uint8Array> {
  const result = await io.writeDocument('fig', graph, { renderThumbnail: true })
  return result.data
}

export async function createFigma(graph: SceneGraph): Promise<FigmaAPI> {
  const figma = new FigmaAPI(graph)
  const renderer = await measureTextHeadlessly()
  renderer.nodePaths.clear()
  renderer.invalidateAllPictures()
  figma.setRenderer(renderer)
  figma.exportImage = (nodeIds, options) =>
    headlessRenderNodes(graph, options.pageId ?? figma.currentPageId, nodeIds, options)
  figma.rasterCodec = createCanvasKitRasterCodec(await initCanvasKit())
  return figma
}

export async function executeTool(
  graph: SceneGraph,
  figma: FigmaAPI,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: unknown; changed: boolean }> {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Unknown OpenPencil tool: ${name}`)
  await tool.loadFonts(figma, args)
  const { result, impact } = await collectSceneMutation(graph, () => tool.execute(figma, args))
  const textIds = [...impact.changedNodeIds].filter((id) => graph.getNode(id)?.type === 'TEXT')
  if (textIds.length > 0) {
    await prepareGraphFonts(graph, textIds)
    for (const id of textIds) sizeAutoResizingText(graph, id)
  }
  return { result, changed: toolChangesDocument(tool) }
}

export function pageIdOf(figma: FigmaAPI, graph: SceneGraph, pageId?: string): string {
  const requested = pageId ?? figma.currentPageId
  const page = graph.getNode(requested)
  if (page?.type === 'CANVAS') {
    if (pageId) {
      const proxy = figma.getNodeById(pageId)
      if (proxy) figma.currentPage = proxy
    }
    return requested
  }
  const fallback = graph.getPages()[0]
  if (!fallback) throw new Error('The document has no page')
  const proxy = figma.getNodeById(fallback.id)
  if (!proxy) throw new Error(`Page not found: ${fallback.id}`)
  figma.currentPage = proxy
  return fallback.id
}
