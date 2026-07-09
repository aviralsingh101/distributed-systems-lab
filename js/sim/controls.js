/**
 * mountSimulation wires a topic's declarative config to the 2D Stage and builds
 * the standard control panel (parameter sliders, dropdowns, scenario toggle
 * switches, and Play / Step / Reset transport).
 *
 * Topic contract: createSimulation(stage, panelEl, stageEl) returns this handle.
 *
 * config = {
 *   note, grid, params:[{key,label,min,max,step,value,unit,live}],
 *   selects:[{key,label,options,value}], toggles:[{key,label,kind,value}],
 *   speed, stepBy, autoplay,
 *   build(ctx), frame(ctx, t, dt), status(ctx)->{text,cls}
 * }
 * ctx = { stage, d (Draw), params, selects, toggles, state, t, playing, setNote, setStatus }
 */
export function mountSimulation(stage, panelEl, stageEl, config) {
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
    stage, d: stage.g, params, selects, toggles, state: {}, t: 0, playing: true,
    setNote: (x) => (note.textContent = x),
    setStatus: (x, cls = "") => { status.textContent = x; status.className = "sim-status " + cls; },
  };

  let t = 0;
  let playing = config.autoplay !== false;
  const speed = config.speed || 1;
  const stepBy = config.stepBy || 0.5;

  function syncPlayBtn() {
    playBtn.textContent = playing ? "Pause" : "Play";
  }

  function rebuild() {
    ctx.state = {};
    t = 0;
    ctx.t = 0;
    if (config.note) note.textContent = config.note;
    if (config.build) config.build(ctx);
  }

  /** Re-run build() without resetting time/state — for live parameter tweaks. */
  function refreshBuild() {
    if (config.build) config.build(ctx);
  }

  function flowStepSize() {
    const spec = ctx.state.s || ctx.state.spec;
    if (spec?.steps?.length) return spec.stepDur || 1.35;
    return stepBy;
  }

  function tick(dt) {
    if (playing) { t += dt * speed; ctx.t = t; }
    ctx.playing = playing;
    if (config.grid) ctx.d.grid();
    config.frame(ctx, t, playing ? dt : 0);
    if (config.status) { const s = config.status(ctx); if (s) ctx.setStatus(s.text, s.cls); }
  }

  stage.onTick(tick);

  /* ------------------------------------------------------------- panel DOM */
  panelEl.innerHTML = "";
  const frag = document.createElement("div");

  if ((config.params && config.params.length) || (config.selects && config.selects.length)) {
    const h = document.createElement("h4"); h.textContent = "Parameters"; frag.appendChild(h);
  }

  (config.params || []).forEach((p) => {
    const wrap = document.createElement("div"); wrap.className = "ctrl";
    const lab = document.createElement("label");
    const name = document.createElement("span"); name.textContent = p.label;
    const val = document.createElement("span"); val.className = "val";
    const fmt = (v) => `${v}${p.unit || ""}`;
    val.textContent = fmt(p.value);
    lab.append(name, val);
    const input = document.createElement("input");
    input.type = "range"; input.min = p.min; input.max = p.max; input.step = p.step ?? 1; input.value = p.value;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      params[p.key] = v;
      val.textContent = fmt(v);
      if (p.live) refreshBuild();
      else rebuild();
    });
    wrap.append(lab, input); frag.appendChild(wrap);
  });

  (config.selects || []).forEach((s) => {
    const wrap = document.createElement("div"); wrap.className = "ctrl";
    const lab = document.createElement("label");
    const name = document.createElement("span"); name.textContent = s.label; lab.appendChild(name);
    const sel = document.createElement("select");
    s.options.forEach((o) => {
      const opt = document.createElement("option"); opt.value = o.value; opt.textContent = o.label;
      if (o.value === s.value) opt.selected = true; sel.appendChild(opt);
    });
    sel.addEventListener("change", () => { selects[s.key] = sel.value; rebuild(); });
    wrap.append(lab, sel); frag.appendChild(wrap);
  });

  if (config.toggles && config.toggles.length) {
    const d = document.createElement("div"); d.className = "divider"; frag.appendChild(d);
    const h = document.createElement("h4"); h.textContent = "Scenario switches"; frag.appendChild(h);
    config.toggles.forEach((tg) => {
      const row = document.createElement("div"); row.className = "toggle-row";
      const span = document.createElement("span"); span.textContent = tg.label;
      const sw = document.createElement("label"); sw.className = "switch " + (tg.kind || "");
      const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!tg.value;
      const slider = document.createElement("span"); slider.className = "slider";
      input.addEventListener("change", () => { toggles[tg.key] = input.checked; rebuild(); });
      sw.append(input, slider); row.append(span, sw); frag.appendChild(row);
    });
  }

  const d2 = document.createElement("div"); d2.className = "divider"; frag.appendChild(d2);
  const transport = document.createElement("div"); transport.className = "transport";
  const playBtn = document.createElement("button"); playBtn.className = "btn primary"; playBtn.textContent = playing ? "Pause" : "Play";
  playBtn.addEventListener("click", () => { playing = !playing; ctx.playing = playing; syncPlayBtn(); });
  const stepBtn = document.createElement("button"); stepBtn.className = "btn"; stepBtn.textContent = "Step";
  stepBtn.addEventListener("click", () => {
    playing = false;
    ctx.playing = false;
    syncPlayBtn();
    t += flowStepSize();
    ctx.t = t;
  });
  const resetBtn = document.createElement("button"); resetBtn.className = "btn"; resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => { rebuild(); });
  transport.append(playBtn, stepBtn, resetBtn); frag.appendChild(transport);

  panelEl.appendChild(frag);
  ctx.playing = playing;
  rebuild();

  return {
    dispose() {
      stage.onTick(null);
      note.remove();
      status.remove();
    },
  };
}
