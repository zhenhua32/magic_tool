const MAX_HTML_LENGTH = 50000
const MAX_DEPTH = 10
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'LINK', 'META',
])
const KEEP_ATTRS = new Set([
  'id', 'class', 'name', 'type', 'value', 'href', 'src', 'alt',
  'title', 'placeholder', 'role', 'aria-label', 'for', 'action',
  'method', 'data-testid', 'data-id',
  'disabled', 'checked', 'selected', 'readonly', 'required',
  'aria-disabled', 'aria-hidden', 'aria-expanded',
])
const INTERACTIVE_TAGS = new Set([
  'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL',
  'DETAILS', 'SUMMARY',
])

function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function extractNode(node: Node, depth: number): string {
  if (depth > MAX_DEPTH) return ''

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? ''
    return text ? text.slice(0, 200) : ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as Element
  if (SKIP_TAGS.has(el.tagName)) return ''

  const tag = el.tagName.toLowerCase()
  const attrs: string[] = []

  for (const attr of el.attributes) {
    if (KEEP_ATTRS.has(attr.name)) {
      attrs.push(`${attr.name}="${attr.value.slice(0, 100)}"`)
    }
  }

  // Add visibility and state info for interactive elements
  if (INTERACTIVE_TAGS.has(el.tagName) || el.getAttribute('role') === 'button' || el.getAttribute('onclick')) {
    const visible = isElementVisible(el)
    attrs.push(`data-visible="${visible}"`)
    if ((el as HTMLButtonElement).disabled) {
      if (!attrs.some(a => a.startsWith('disabled'))) {
        attrs.push('disabled="true"')
      }
    }
  }

  const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
  const children = Array.from(el.childNodes)
    .map((child) => extractNode(child, depth + 1))
    .filter(Boolean)
    .join('\n')

  if (!children && !attrs.length && el.childNodes.length === 0) return ''

  return `<${tag}${attrStr}>${children ? '\n' + children + '\n' : ''}</${tag}>`
}

export function extractHTML(): string {
  const html = extractNode(document.body, 0)
  if (html.length > MAX_HTML_LENGTH) {
    return html.slice(0, MAX_HTML_LENGTH) + '\n<!-- truncated -->'
  }
  return html
}
