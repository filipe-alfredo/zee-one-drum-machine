/**
 * Minimal DOM construction helpers. Building nodes with these helpers keeps
 * user-provided names (pattern, group, sample file names) out of innerHTML.
 */

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  const { className, text, title, dataset, attributes } = options;

  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  if (title !== undefined) element.title = title;

  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) {
      element.dataset[key] = String(value);
    }
  }

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value === false || value === null || value === undefined) continue;
      element.setAttribute(key, value === true ? '' : String(value));
    }
  }

  return element;
}

export function replaceChildren(element, ...children) {
  element.replaceChildren(...children);
  return element;
}
