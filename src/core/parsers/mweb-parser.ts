import { getChildContextElements } from './utils'
import { IParser, InsertionPoint } from './interface'
import { InsertionType } from '../adapters/interface'

const ParsedContextAttr = 'data-mweb-context-parsed'
const ContextTypeAttr = 'data-mweb-context-type'
const InsPointAttr = 'data-mweb-insertion-point'
const ShadowHostAttr = 'data-mweb-shadow-host'
const LayoutManagerAttr = 'data-mweb-layout-manager'

export class MutableWebParser implements IParser {
  parseContext(element: Element, contextName: string) {
    const json = element.getAttribute(ParsedContextAttr)
    if (!json) return {}
    return JSON.parse(json)
  }

  findChildElements(element: Element) {
    return getChildContextElements(element, ContextTypeAttr).map((element) => ({
      element,
      contextName: element.getAttribute(ContextTypeAttr)!,
    }))
  }

  findInsertionPoint(
    element: Element | ShadowRoot,
    contextName: string,
    insertionPoint: string
  ): Element | null {
    // ToDo: use getChildContextElements

    const insPointElement = element.querySelector(`[${InsPointAttr}="${insertionPoint}"]`)
    if (insPointElement) return insPointElement

    if (element instanceof Element && element.hasAttribute(ShadowHostAttr) && element.shadowRoot) {
      return this.findInsertionPoint(element.shadowRoot, contextName, insertionPoint)
    }

    const shadowHosts = element.querySelectorAll(`[${ShadowHostAttr}]`)
    for (const shadowHost of shadowHosts) {
      if (!shadowHost.shadowRoot) continue

      const insPointElement = this.findInsertionPoint(
        shadowHost.shadowRoot,
        contextName,
        insertionPoint
      )

      if (insPointElement) return insPointElement
    }

    return null
  }

  getInsertionPoints(element: Element): InsertionPoint[] {
    return getChildContextElements(element, InsPointAttr, ContextTypeAttr).map((el) => ({
      name: el.getAttribute(InsPointAttr)!,
      insertionType: InsertionType.End,
      bosLayoutManager: el.getAttribute(LayoutManagerAttr) || undefined,
    }))
  }
}
