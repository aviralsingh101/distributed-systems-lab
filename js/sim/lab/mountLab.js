/**
 * mountLab — click/event-driven simulation mount (no Play/Pause/Step by default).
 * Used for token-bucket-style labs with actions, metrics, and sustained toggles.
 */
export function mountLab(stage, panelEl, stageEl, config) {
  const params = {};
  (config.params || []).forEach((p) => (params[p.key] = p.value));
  const selects = {};
  (config.selects || []).forEach((s) => (selects[s.key] = s.value));
  const toggles = {};
  (config.toggles || []).forEach((t) => (toggles[t.key] = !!t.value));

  const note = document.createElement("div");
  note.className = "sim-note";
  note.textContent = config.note || "";
  stageEl.appendChild(note);
  const status = document.createElement("div");
  status.className = "sim-status";
  stageEl.appendChild(status);

  const ctx = {
    stage,
    d: stage.g,
    params,
    selects,
    toggles,
    state: {},
    t: 0,
    setNote: (x) => (note.textContent = x),
    setStatus: (x, cls = "") => {
      status.textContent = x;
      status.className = "sim-status " + cls;
    },
  };

  let t = 0;

  function reset() {
    ctx.state = {};
    t = 0;
    ctx.t = 0;
    if (config.note) note.textContent = config.note;
    if (config.init) config.init(ctx);
    if (config.onReset) config.onReset(ctx);
  }

  function tick(dt) {
    t += dt;
    ctx.t = t;
    if (config.grid) ctx.d.grid();
    if (config.frame) config.frame(ctx, t, dt);
    if (config.status) {
      const s = config.status(ctx);
      if (s) ctx.setStatus(s.text, s.cls);
    }
  }

  stage.onTick(tick);

  panelEl.innerHTML = "";
  const frag = document.createElement("div");

  if (config.actions?.length) {
    const h = document.createElement("h4");
    h.textContent = "Actions";
    frag.appendChild(h);
    const row = document.createElement("div");
    row.className = "transport";
    config.actions.forEach((act) => {
      const btn = document.createElement("button");
      btn.className = "btn" + (act.primary ? " primary" : "");
      btn.textContent = act.label;
      btn.id = act.id ? `lab-${act.id}` : undefined;
      btn.addEventListener("click", () => act.onClick(ctx));
      row.appendChild(btn);
    });
    frag.appendChild(row);
  }

  if ((config.params?.length) || (config.selects?.length)) {
    const d = document.createElement("div");
    d.className = "divider";
    frag.appendChild(d);
    const h = document.createElement("h4");
    h.textContent = "Parameters";
    frag.appendChild(h);
  }

  (config.params || []).forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "ctrl";
    const lab = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = p.label;
    const val = document.createElement("span");
    val.className = "val";
    const fmt = (v) => `${v}${p.unit || ""}`;
    val.textContent = fmt(p.value);
    lab.append(name, val);
    const input = document.createElement("input");
    input.type = "range";
    input.min = p.min;
    input.max = p.max;
    input.step = p.step ?? 1;
    input.value = p.value;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      params[p.key] = v;
      val.textContent = fmt(v);
      if (p.onChange) p.onChange(ctx, v);
    });
    wrap.append(lab, input);
    frag.appendChild(wrap);
  });

  (config.selects || []).forEach((s) => {
    const wrap = document.createElement("div");
    wrap.className = "ctrl";
    const lab = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = s.label;
    lab.appendChild(name);
    const sel = document.createElement("select");
    s.options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === s.value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      selects[s.key] = sel.value;
      if (s.onChange) s.onChange(ctx, sel.value);
    });
    wrap.append(lab, sel);
    frag.appendChild(wrap);
  });

  if (config.toggles?.length) {
    const d = document.createElement("div");
    d.className = "divider";
    frag.appendChild(d);
    const h = document.createElement("h4");
    h.textContent = "Controls";
    frag.appendChild(h);
    config.toggles.forEach((tg) => {
      const row = document.createElement("div");
      row.className = "toggle-row";
      const span = document.createElement("span");
      span.textContent = tg.label;
      const sw = document.createElement("label");
      sw.className = "switch " + (tg.kind || "");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!tg.value;
      const slider = document.createElement("span");
      slider.className = "slider";
      input.addEventListener("change", () => {
        toggles[tg.key] = input.checked;
        if (tg.onChange) tg.onChange(ctx, input.checked);
      });
      sw.append(input, slider);
      row.append(span, sw);
      frag.appendChild(row);
    });
  }

  if (config.transport !== false) {
    const d2 = document.createElement("div");
    d2.className = "divider";
    frag.appendChild(d2);
    const transport = document.createElement("div");
    transport.className = "transport";
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", reset);
    transport.appendChild(resetBtn);
    frag.appendChild(transport);
  }

  const labActions = (config.actions || []).map((act) => ({
    id: act.id,
    onClick: () => act.onClick(ctx),
  }));

  panelEl.appendChild(frag);
  reset();

  return {
    ctx,
    actions: labActions,
    dispose() {
      stage.onTick(null);
      note.remove();
      status.remove();
    },
  };
}
