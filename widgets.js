/* ============================================================================
   VECTOR widgets
   Each widget exposes:
     html(id, opts)   -> markup string to insert into the DOM
     mount(id, opts)  -> call once the markup above is in the DOM; wires events
   The pattern mirrors a two-pane widget with a live readout strip and a note,
   same shell classes as the rest of the site (.widget, .panes, .readout, .wctl).
   ========================================================================= */
const Widgets = (() => {

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  // ---- Register bit widget ------------------------------------------------
  // Eight clickable bits form a byte; the right pane shows the same byte as
  // eight GPIO pin states (LEDs). Teaches bit math (hex/dec/binary) and the
  // idea that a register IS the pins, not just a number.
  function registerBitsHTML(id, opts) {
    opts = opts || {};
    const title = opts.title || "Register bit widget";
    const hint = opts.hint || "GPIO_ODR";
    return `
    <div class="widget" id="${id}">
      <div class="widget-head">
        <span class="wt">${title}</span>
        <span class="wh">${hint}</span>
      </div>
      <div class="panes">
        <div class="pane">
          <div class="pane-lbl">Click a bit to toggle it</div>
          <svg viewBox="0 0 320 90" data-role="bits"></svg>
        </div>
        <div class="pane">
          <div class="pane-lbl">Pin state (bit 7 → bit 0)</div>
          <svg viewBox="0 0 320 90" data-role="pins"></svg>
        </div>
      </div>
      <div class="readout">
        <div class="ro"><div class="k">Binary</div><div class="v" data-role="bin">0000 0000</div></div>
        <div class="ro"><div class="k">Hex</div><div class="v" data-role="hex">0x00</div></div>
        <div class="ro"><div class="k">Decimal</div><div class="v" data-role="dec">0</div></div>
        <div class="ro"><div class="k">Bits set</div><div class="v" data-role="cnt">0</div></div>
      </div>
      <div class="wnote" data-role="note"></div>
    </div>`;
  }

  function registerBitsMount(id, opts) {
    opts = opts || {};
    const root = document.getElementById(id);
    if (!root) return;
    let value = typeof opts.initial === "number" ? opts.initial : 0b00000000;
    const bitsSvg = root.querySelector('[data-role="bits"]');
    const pinsSvg = root.querySelector('[data-role="pins"]');
    const binEl = root.querySelector('[data-role="bin"]');
    const hexEl = root.querySelector('[data-role="hex"]');
    const decEl = root.querySelector('[data-role="dec"]');
    const cntEl = root.querySelector('[data-role="cnt"]');
    const noteEl = root.querySelector('[data-role="note"]');
    const cellW = 36, gap = 4, startX = 8, y = 14, boxH = 40;

    function bitCells(svg, interactive) {
      svg.innerHTML = "";
      for (let i = 7; i >= 0; i--) {
        const col = 7 - i;
        const x = startX + col * (cellW + gap);
        const g = svgEl("g", { class: "bit" + (interactive ? "" : "") , "data-bit": i });
        const rect = svgEl("rect", { x, y, width: cellW, height: boxH, rx: 6 });
        const label = svgEl("text", { x: x + cellW / 2, y: y + boxH + 16, "text-anchor": "middle" });
        label.textContent = i;
        const val = svgEl("text", { x: x + cellW / 2, y: y + boxH / 2 + 5, "text-anchor": "middle", "font-weight": "600" });
        g.appendChild(rect); g.appendChild(val); g.appendChild(label);
        svg.appendChild(g);
        if (interactive) {
          g.style.cursor = "pointer";
          g.addEventListener("click", () => { value ^= (1 << i); render(); });
        }
      }
    }

    function render() {
      bitCells(bitsSvg, true);
      bitCells(pinsSvg, false);
      // paint state
      for (let i = 0; i < 8; i++) {
        const on = (value >> i) & 1;
        const bg = bitsSvg.querySelector(`[data-bit="${i}"]`);
        const pg = pinsSvg.querySelector(`[data-bit="${i}"]`);
        [bg, pg].forEach(g => {
          if (!g) return;
          g.classList.toggle("on", !!on);
          g.querySelector("rect").setAttribute("fill", on ? "var(--high)" : "var(--sunk)");
          g.querySelector("rect").setAttribute("stroke", on ? "var(--high)" : "var(--line)");
          const valText = g.querySelectorAll("text")[0];
          valText.textContent = on ? "1" : "0";
          valText.setAttribute("fill", on ? "#fff" : "var(--muted)");
        });
      }
      const bin = value.toString(2).padStart(8, "0");
      binEl.textContent = bin.slice(0, 4) + " " + bin.slice(4);
      hexEl.textContent = "0x" + value.toString(16).toUpperCase().padStart(2, "0");
      decEl.textContent = String(value);
      const bitsSet = bin.split("").filter(c => c === "1").length;
      cntEl.textContent = String(bitsSet);
      if (noteEl) {
        noteEl.innerHTML = value === 0
          ? "All pins driven low. <b>Nothing lights.</b>"
          : `Writing <b>0x${value.toString(16).toUpperCase().padStart(2,"0")}</b> to this register sets bit${bitsSet>1?"s":""} ${bin.split("").map((c,idx)=>c==="1"?7-idx:null).filter(v=>v!==null).join(", ")} — those pins go high on the next clock edge, everything else stays low.`;
      }
    }
    render();
  }

  // ---- PWM waveform widget -------------------------------------------------
  // Sliders for frequency and duty cycle draw a live pulse train and report
  // period / on-time / off-time — the numbers a timer's ARR/CCR registers
  // actually encode.
  function pwmHTML(id, opts) {
    opts = opts || {};
    const title = opts.title || "PWM widget";
    return `
    <div class="widget" id="${id}">
      <div class="widget-head">
        <span class="wt">${title}</span>
        <span class="wh">TIMx → CCRx</span>
      </div>
      <div class="panes">
        <div class="pane">
          <div class="pane-lbl">Three periods</div>
          <svg viewBox="0 0 320 90" data-role="wave"></svg>
        </div>
        <div class="pane">
          <div class="pane-lbl">One period, to scale</div>
          <svg viewBox="0 0 320 90" data-role="wave1"></svg>
        </div>
      </div>
      <div class="readout">
        <div class="ro"><div class="k">Period T</div><div class="v" data-role="period"></div></div>
        <div class="ro"><div class="k">On-time</div><div class="v" data-role="ton"></div></div>
        <div class="ro"><div class="k">Off-time</div><div class="v" data-role="toff"></div></div>
        <div class="ro"><div class="k">Duty</div><div class="v" data-role="duty"></div></div>
      </div>
      <div class="wctl">
        <label for="${id}-freq">Freq</label>
        <input type="range" id="${id}-freq" min="1" max="1000" step="1" value="${opts.initFreq || 100}">
        <label for="${id}-duty">Duty</label>
        <input type="range" id="${id}-duty" min="1" max="99" step="1" value="${opts.initDuty || 30}">
      </div>
      <div class="wnote" data-role="note"></div>
    </div>`;
  }

  function fmtTime(seconds) {
    if (seconds >= 1) return seconds.toFixed(3) + " s";
    if (seconds >= 1e-3) return (seconds * 1e3).toFixed(2) + " ms";
    return (seconds * 1e6).toFixed(1) + " µs";
  }

  function pwmMount(id, opts) {
    const root = document.getElementById(id);
    if (!root) return;
    const freqInput = root.querySelector(`#${id}-freq`);
    const dutyInput = root.querySelector(`#${id}-duty`);
    const waveSvg = root.querySelector('[data-role="wave"]');
    const wave1Svg = root.querySelector('[data-role="wave1"]');
    const periodEl = root.querySelector('[data-role="period"]');
    const tonEl = root.querySelector('[data-role="ton"]');
    const toffEl = root.querySelector('[data-role="toff"]');
    const dutyEl = root.querySelector('[data-role="duty"]');
    const noteEl = root.querySelector('[data-role="note"]');

    function drawWave(svg, periods) {
      svg.innerHTML = "";
      const freq = Number(freqInput.value);
      const duty = Number(dutyInput.value) / 100;
      const w = 320, h = 90, pad = 8;
      const usableW = w - pad * 2;
      const periodW = usableW / periods;
      const highY = 22, lowY = 62;
      let d = `M ${pad} ${lowY}`;
      for (let p = 0; p < periods; p++) {
        const x0 = pad + p * periodW;
        const xHighEnd = x0 + periodW * duty;
        const x1 = x0 + periodW;
        d += ` L ${x0} ${highY} L ${xHighEnd} ${highY} L ${xHighEnd} ${lowY} L ${x1} ${lowY}`;
      }
      const path = svgEl("path", { d, fill: "none", stroke: "var(--high)", "stroke-width": "2.4", "stroke-linecap": "round", "stroke-linejoin": "round" });
      svg.appendChild(path);
      const baseline = svgEl("line", { x1: pad, y1: lowY, x2: w - pad, y2: lowY, stroke: "var(--line)", "stroke-width": "1" });
      svg.insertBefore(baseline, path);
    }

    function render() {
      const freq = Number(freqInput.value);
      const duty = Number(dutyInput.value) / 100;
      const T = 1 / freq;
      const ton = T * duty;
      const toff = T - ton;
      periodEl.textContent = fmtTime(T);
      tonEl.textContent = fmtTime(ton);
      toffEl.textContent = fmtTime(toff);
      dutyEl.textContent = (duty * 100).toFixed(0) + "%";
      drawWave(waveSvg, 3);
      drawWave(wave1Svg, 1);
      if (noteEl) {
        noteEl.innerHTML = `At <b>${freq} Hz</b>, the timer must reload every <b>${fmtTime(T)}</b>. To hold a ${(duty*100).toFixed(0)}% duty, the compare register fires <b>${fmtTime(ton)}</b> into each period — everything after that until the next reload is off.`;
      }
    }
    freqInput.addEventListener("input", render);
    dutyInput.addEventListener("input", render);
    render();
  }

  return {
    registerBits: { html: registerBitsHTML, mount: registerBitsMount },
    pwm: { html: pwmHTML, mount: pwmMount },
  };
})();
