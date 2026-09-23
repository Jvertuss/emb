registerChapter({
  id: "ch04",
  title: "Timers & PWM",
  brief: [
    "A hardware timer is a counter wired directly to a clock source, incrementing on its own with no CPU instructions spent — which makes it the tool of choice for anything that needs to happen at a precise interval, or anything you'd otherwise be tempted to do with a blocking delay loop.",
    "This chapter derives timer period from clock and prescaler, builds duty cycle up from that same arithmetic, and revisits the debounce and shared-variable problems from earlier chapters now that a timer is available to solve them properly.",
  ],
  sections: [
    {
      id: "04.1",
      name: "Counting time in hardware",
      items: [
        {
          id: "prescaler-period",
          title: "Prescaler, ARR, and where the period comes from",
          body: `A timer peripheral counts up (or down) once per tick of its input clock, and two registers decide how long that takes to become something useful. The **prescaler** divides the clock down before it reaches the counter:

$$t_{tick} = \\dfrac{\\text{Prescaler}+1}{f_{clk}}$$

(the $+1$ is because a prescaler value of 0 conventionally means "divide by 1," not "divide by 0.") The **auto-reload register (ARR)** sets how many ticks the counter counts before it wraps back to zero and, typically, fires an interrupt or update event:

$$T = (\\text{ARR}+1)\\cdot t_{tick}$$

So a $16\\text{ MHz}$ clock, a prescaler of $15$ (dividing by 16), and an ARR of $999$ gives $t_{tick} = 1\\ \\mu s$ and $T = 1000\\ \\mu s = 1\\ \\text{ms}$ — a timer that overflows exactly once per millisecond, with the CPU free to do anything else in between.`,
        },
        {
          id: "pwm-basics",
          title: "PWM: faking analog with a fast switch",
          body: `Pulse-width modulation drives a pin fully high for part of each period and fully low for the rest — never anything in between — and relies on whatever is downstream (an LED, a motor, a human eye) being too slow to see the individual pulses, so it only perceives the average. That average is the [[concept:duty-cycle]]:

$$D = \\dfrac{T_{on}}{T} \\times 100\\%$$

A timer generates this by comparing its counter against a second register (often called CCR, the capture/compare register) each tick: the output pin is driven high while the counter is below CCR and low once it passes CCR, then the whole thing resets at the next overflow. So the compare value for a target duty $D$ is just:

$$\\text{CCR} = D \\cdot (\\text{ARR}+1)$$

Try it below — the frequency slider changes how fast the whole pattern repeats, and the duty slider changes how much of each repeat is spent high.

[[widget:pwm|title=PWM generator]]

A duty of 50% at any frequency looks, on average, like "half power." The same duty at 20 Hz vs. 20 kHz can look identical on a multimeter but completely different to a human eye — below roughly 50–60 Hz, individual pulses are visible as flicker; above it, they blur into a steady dimmed glow.`,
        },
      ],
    },
    {
      id: "04.2",
      name: "Timers doing someone else's job",
      items: [
        {
          id: "timer-debounce",
          title: "Debouncing without blocking",
          body: `Chapter 2 debounced a button with a blocking \`delay_ms(10)\`, which works but freezes the entire program for that window. A timer fixes this by turning "wait 10 ms, then recheck" into "let a timer interrupt every 10 ms handle the recheck," so the main program is never stopped:

\`\`\`
// timer ISR, fires every 10 ms
void TIMER_ISR(void) {
    static uint8_t last_stable = 1;
    uint8_t now = read_pin();
    if (now == last_stable) {
        stable_reading = now;   // confirmed unchanged for a full 10 ms
    }
    last_stable = now;
}
\`\`\`

The main program just reads \`stable_reading\` whenever it wants the button's debounced state — it never waits on anything. This is the same [[concept:debounce]] idea as before, just moved off the CPU's critical path and onto hardware that was going to keep ticking regardless.`,
        },
        {
          id: "isr-timing",
          title: "Sharing a variable with an ISR",
          body: `\`stable_reading\` in the example above is written by an interrupt and read by \`main()\` — the same shared-memory situation as Chapter 1's [[concept:atomic-access]] problem, just with a timer ISR instead of two arbitrary pieces of code. Two things follow directly from that chapter's read-modify-write analysis:

First, the variable must be \`volatile\`, or the compiler may cache \`main()\`'s copy of \`stable_reading\` in a CPU register and never notice the ISR changed the real memory location.

Second, if \`main()\` ever does more than a single plain read of a shared variable — say, reading a 32-bit timestamp on an 8-bit microcontroller, which takes multiple instructions to load a byte at a time — an interrupt landing mid-read can hand back a value that was never valid at any single instant: half old bytes, half new bytes. The general fix is to disable interrupts for the few instructions of the read (or write), copy the value out, and re-enable — trading a few microseconds of interrupt latency for a guarantee that the value read is always one the ISR actually produced, never a torn mix of two.`,
        },
      ],
    },
  ],
  problems: [
    {
      id: "ch04-p1",
      tags: ["warmup"],
      body: "A timer runs from a $8\\text{ MHz}$ clock with a prescaler of $7$. What is the tick period $t_{tick}$?",
      hint: "$t_{tick} = \\dfrac{\\text{Prescaler}+1}{f_{clk}}$ — remember the $+1$.",
      solution: "$t_{tick} = \\dfrac{7+1}{8{,}000{,}000} = \\dfrac{8}{8{,}000{,}000} = 1\\ \\mu s$.",
    },
    {
      id: "ch04-p2",
      tags: ["warmup"],
      body: "Using the timer from the previous problem ($t_{tick}=1\\ \\mu s$), what ARR value produces an overflow period of exactly $5\\text{ ms}$?",
      hint: "$T = (\\text{ARR}+1)\\cdot t_{tick}$ — solve for ARR.",
      solution: "$5000\\ \\mu s = (\\text{ARR}+1)\\cdot 1\\ \\mu s \\Rightarrow \\text{ARR} = 4999$.",
    },
    {
      id: "ch04-p3",
      tags: ["core"],
      body: "A PWM timer has $\\text{ARR}=249$. What CCR value gives a 40% duty cycle, and what is the actual duty cycle achieved (CCR must be a whole number)?",
      hint: "$\\text{CCR} = D \\cdot (\\text{ARR}+1)$, then round and recompute $D$ from the rounded value.",
      solution: "$\\text{CCR} = 0.40 \\times 250 = 100$ exactly, so the achieved duty is exactly $\\dfrac{100}{250}=40\\%$ — this ARR happens to divide evenly. (With an ARR that didn't divide evenly, you'd round CCR to the nearest integer and accept a small duty error.)",
    },
    {
      id: "ch04-p4",
      tags: ["core"],
      body: "Why does moving the debounce recheck from a blocking `delay_ms(10)` into a timer ISR that runs every 10 ms not change *how long it takes* to confirm a button press, but does change what the CPU is able to do during that wait?",
      hint: "Compare what each version's 10 ms is spent doing.",
      solution: "Both versions still need roughly 10 ms of real time to confirm the mechanical bounce has settled — that's a property of the switch, not the code, so no software change speeds it up. The difference is that `delay_ms(10)` occupies the CPU in a busy-wait for that whole window, while the timer-ISR version lets `main()` keep running and only borrows the CPU for the few instructions of the ISR itself each time the timer fires.",
    },
    {
      id: "ch04-p5",
      tags: ["challenge"],
      body: "An 8-bit microcontroller keeps a 16-bit millisecond counter, incremented by a timer ISR every millisecond. `main()` reads this counter with `uint16_t t = millis;` where `millis` is a `volatile uint16_t`. Explain how `main()` could read a completely wrong value — neither the old count nor the new one — even though `millis` is correctly marked `volatile`, and describe a fix.",
      hint: "An 8-bit CPU can't move 16 bits in a single instruction. How many separate loads does reading a 16-bit variable actually take, and what happens if the ISR fires between them?",
      solution: "Reading a 16-bit variable on an 8-bit CPU takes two 8-bit loads (low byte, then high byte, or vice versa). `volatile` only guarantees each of those loads reads real memory instead of a cached value — it says nothing about the two loads happening as one atomic unit. If the timer ISR increments `millis` from, say, `0x00FF` to `0x0100` in between `main()`'s low-byte read and high-byte read, `main()` can end up combining a low byte from before the rollover with a high byte from after it, producing a value like `0x01FF` that `millis` never actually held at any instant. The fix is to disable interrupts around the two-byte read (or use a hardware feature designed for atomic multi-byte reads, where available), copy the value out, then re-enable interrupts.",
      expert: "This exact hazard is why many 8-bit toolchains' standard timekeeping libraries disable interrupts for a handful of cycles inside their own `millis()`-equivalent accessor — it looks like unnecessary defensiveness until you've been burned by the one-in-a-million rollover-timed read that returns a value 256 counts too high.",
    },
  ],
});
