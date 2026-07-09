/**
 * DOM overlay inside the sim stage for rich UI (queues, message chips, alerts).
 */
export function createDomOverlay(stageEl) {
  const root = document.createElement("div");
  root.className = "lab-dom-overlay";
  root.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;";
  stageEl.appendChild(root);

  return {
    el: root,
    clear() { root.innerHTML = ""; },
    place(id, html, style = {}) {
      let node = root.querySelector(`[data-id="${id}"]`);
      if (!node) {
        node = document.createElement("div");
        node.dataset.id = id;
        root.appendChild(node);
      }
      node.innerHTML = html;
      Object.assign(node.style, {
        position: "absolute",
        pointerEvents: "none",
        ...style,
      });
      return node;
    },
    remove(id) {
      root.querySelector(`[data-id="${id}"]`)?.remove();
    },
    dispose() {
      root.remove();
    },
  };
}
