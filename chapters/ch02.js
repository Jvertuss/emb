registerChapter({
  id: "ch02",
  title: "GPIO: Digital Input & Output",
  brief: [
    "General-purpose I/O pins are the simplest peripheral on any microcontroller and the one every other chapter assumes you already understand: a pin is either driven or read, and both directions have failure modes that only show up once real hardware — a switch, an LED, another chip — is attached.",
    "This chapter covers the pin's four common configurations, what a floating input actually does, and the mechanical reality of a button press that makes \"just read the pin\" not quite enough.",
  ],
  sections: [
    {
      id: "02.1",
      name: "Pin modes",
      items: [
        {
          id: "push-pull-vs-open-drain",
          title: "Push-pull vs. open-drain output",
          body: `A **push-pull** output actively drives the pin to both logic levels: an internal transistor connects the pin to Vcc for a 1, and a different one connects it to ground for a 0. This is the default for driving an LED or another chip's input directly — it can both source and sink current.

An **open-drain** output can only pull the pin to ground; driving a 1 means the transistor disconnects and the pin floats unless something else pulls it high. That "something else" is almost always an external pull-up resistor. The reason to want this seemingly weaker mode: several open-drain outputs can share one wire safely. If two push-pull outputs disagree — one driving high, one driving low — they fight, and one of them is dissipating power fighting a short. If two open-drain outputs disagree, the one pulling low simply wins, because the other one isn't driving anything, it's only *not* pulling low. This is exactly how I2C's shared SDA and SCL lines work with multiple devices on the same two wires.`,
        },
        {
          id: "floating-input",
          title: "What a floating input actually reads",
          body: `Configure a pin as an input with no pull resistor and nothing externally connected, and the pin isn't at "0V" or "logic 0" — it's electrically nowhere. A tiny, essentially random amount of stray capacitance and induced noise from nearby wires determines what the input register reads on any given cycle, and that value can change from one read to the next with no cause you can see in your own circuit.

A **pull-up** resistor (to Vcc) guarantees the pin reads 1 until something actively pulls it to ground — the standard setup for a button wired to ground, since pressing the button is the only thing capable of overpowering the weak pull-up. A **pull-down** resistor is the mirror image: the pin defaults to 0 until something pulls it to Vcc. Get the polarity backwards — a pull-up on a button wired to Vcc instead of ground, say — and the pin idles at the "pressed" reading and briefly dips to "released" on every real press, inverting your logic without a single wire being loose.`,
        },
      ],
    },
    {
      id: "02.2",
      name: "Reading the real world",
      items: [
        {
          id: "button-bounce",
          title: "A switch is not a clean edge",
          body: `Press a mechanical button and, at the metal-contact level, the two pieces of metal don't touch once — they physically bounce apart and together several times over a few milliseconds before settling, the same way a dropped ball bounces before it lies still. Wire that switch straight into a GPIO pin polled fast enough (or, worse, into an interrupt on every edge) and one human press registers as anywhere from two to a dozen "presses," each just microseconds apart.

This is the [[concept:debounce]] problem, and it has nothing to do with your code being wrong — it's a property of the metal, not the software. The simplest fix costs no extra hardware: after seeing an edge, wait a few milliseconds — long enough for the mechanical bounce to physically stop, typically 5–20 ms for a small tactile switch — and then read the pin again to confirm the level actually held.

\`\`\`
if (pin_changed()) {
    delay_ms(10);
    if (read_pin() == new_expected_level) {
        // real press, act on it
    }
}
\`\`\`

The obvious problem with this version is the word \`delay_ms\` — it blocks the whole program for 10 ms doing nothing else. Chapter 4 replaces the blocking delay with a timer-driven recheck that costs no CPU time while it waits.`,
        },
        {
          id: "input-vs-output-register",
          title: "Two registers, one pin",
          body: `It's easy to assume a GPIO pin has one register, but most microcontrollers give a port two: an **input data register** (what the pin electrically reads right now) and an **output data register** (what you last told the pin to drive, when it's configured as an output). Reading the output register back doesn't tell you what's actually on the wire — it tells you your own last command, which is only useful for confirming you wrote what you meant to write, not for sensing the physical pin.

This split matters most when a pin's direction can change at runtime, or when debugging: if a "read" of a pin never seems to reflect an external signal, the first thing to check is whether the code is reading the input register or accidentally the output register.`,
        },
      ],
    },
  ],
  problems: [
    {
      id: "ch02-p1",
      tags: ["warmup"],
      body: "A push-button connects a GPIO pin to ground when pressed, and to nothing when released. Should the pin be configured with a pull-up or a pull-down resistor, and what does the pin read when the button is *not* pressed?",
      hint: "Something has to define the level when the button isn't pulling the pin anywhere.",
      solution: "Pull-up. With nothing pressed, the pull-up holds the pin at 1 (high); pressing the button connects it to ground, pulling it to 0 — so this is an active-low button.",
    },
    {
      id: "ch02-p2",
      tags: ["warmup"],
      body: "Two microcontrollers share a single wire, each configured as an open-drain output with one shared external pull-up resistor. Chip A drives a 0, chip B drives a 1 (i.e. releases the line). What logic level appears on the wire, and why?",
      hint: "\"Drives a 1\" on an open-drain pin doesn't mean actively pushing high — what does it mean instead?",
      solution: "The wire reads 0. Chip B \"driving a 1\" on an open-drain pin just means it stops pulling the line low and lets the pull-up try to take it high; chip A is actively pulling it to ground, and a real ground connection always wins over a weak resistor.",
    },
    {
      id: "ch02-p3",
      tags: ["core"],
      body: "A pin is wired as: button to Vcc when pressed, otherwise disconnected — the mirror image of the usual wiring. Which internal resistor should the pin use, and what logic level means \"pressed\"?",
      hint: "Work out what needs to hold the pin at a defined level when the button is *not* pressed, given the button now connects to Vcc rather than ground.",
      solution: "Pull-down. With the button unpressed, the pull-down holds the pin at 0; pressing the button connects it to Vcc, pulling it to 1 — this is an active-high button, and the code should treat a 1 reading as \"pressed.\"",
    },
    {
      id: "ch02-p4",
      tags: ["core"],
      body: "Explain why polling a bouncing button on every single loop iteration (with no delay at all) can register one physical press as multiple logical presses, using the language of \"edges.\"",
      hint: "How many times does the pin's level actually flip during one bounce episode, and what does a naive \"edge = press\" rule do with each flip?",
      solution: "During the few milliseconds of mechanical bounce, the pin's level flips several times between 0 and 1 before settling. If the code treats every 0-to-1 (or every level change) as a fresh button press, each of those bounce-induced flips counts as its own press, so one physical press is logged as several — the code isn't malfunctioning, it's faithfully reporting a signal that is genuinely noisy at that timescale.",
    },
    {
      id: "ch02-p5",
      tags: ["challenge"],
      body: "A pin is configured as a GPIO output and driven high, then the firmware reads that same pin's *output* data register back to \"verify\" the pin is high, and the check always passes — even in a test where the pin is physically shorted to ground by a faulty solder joint. Explain why this verification method can never catch that fault, and describe what would need to change to actually detect it.",
      hint: "What does the output data register actually record, versus what the input data register records?",
      solution: "The output data register stores the last value the CPU commanded — it reflects the firmware's own intent, not the electrical state of the pin, so it will read back \"high\" regardless of what's physically happening on the wire; a hard short to ground never touches that register at all. Detecting the fault requires reading the *input* data register (which reflects the actual electrical level) while the pin is driven high — on many microcontrollers this means the pin must support being read in output mode, or briefly be switched to input to sample the true level.",
      expert: "This is precisely the role of a hardware self-test or `GPIO read-back` errata note in real datasheets — some pin drivers explicitly document whether the input register tracks the pad voltage even while the pin is configured as an output, because relying on this without checking the silicon's actual behavior is a common field-failure root cause.",
    },
  ],
});
