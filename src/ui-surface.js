/* The same UI controller operates the host SafeElement bridge or the native
 * iframe document. Local radio navigation never needs a bridge round trip. */
  const nativeElements = new WeakMap();
  function nativeElement(node) {
    if (!node) return null;
    if (nativeElements.has(node)) return nativeElements.get(node);
    const local = value => String(value).replaceAll('x-risu-', '');
    const port = {
      node,
      querySelector: async selector => nativeElement(node.querySelector(local(selector))),
      createElement: async tag => nativeElement(document.createElement(tag)),
      getParent: async () => nativeElement(node.parentElement),
      getBoundingClientRect: async () => node.getBoundingClientRect(),
      textContent: async () => node.textContent,
      setTextContent: async value => { node.textContent = value; },
      setInnerHTML: async value => { node.innerHTML = value; },
      getInnerHTML: async () => node.innerHTML,
      setClassName: async value => { node.className = local(value); },
      addClass: async value => node.classList.add(local(value)),
      removeClass: async value => node.classList.remove(local(value)),
      setAttribute: async (key, value) => node.setAttribute(key, key === 'class' ? local(value) : value),
      getAttribute: async key => node.getAttribute(key),
      removeAttribute: async key => node.removeAttribute(key),
      appendChild: async child => node.appendChild(child.node),
      remove: async () => node.remove(),
      addEventListener: async (type, handler, capture) => { node.addEventListener(type, handler, capture); return handler; },
      removeEventListener: async (type, handler, capture) => node.removeEventListener(type, handler, capture)
    };
    nativeElements.set(node, port);
    return port;
  }
  function panelDocument() {
    return uiState.panelOpen && typeof document !== 'undefined' ? nativeElement(document) : hostState.mainDoc;
  }
