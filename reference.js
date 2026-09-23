registerReference({
  groups: [
    {
      id: "numbers",
      title: "Number systems & sizes",
      tables: [
        {
          name: "Base conversion",
          cols: ["Decimal", "Binary (8-bit)", "Hex", "Notes"],
          rows: [
            ["0", "0000 0000", "0x00", "all bits clear"],
            ["15", "0000 1111", "0x0F", "low nibble set"],
            ["16", "0001 0000", "0x10", "bit 4 set"],
            ["170", "1010 1010", "0xAA", "alternating — classic test pattern"],
            ["255", "1111 1111", "0xFF", "all bits set, max unsigned 8-bit"],
            ["-1", "1111 1111", "0xFF", "two's complement, signed 8-bit"],
          ],
        },
        {
          name: "Integer ranges",
          cols: ["Width", "Unsigned range", "Signed (two's complement)"],
          rows: [
            ["8-bit", "0 … 255", "-128 … 127"],
            ["16-bit", "0 … 65,535", "-32,768 … 32,767"],
            ["32-bit", "0 … 4,294,967,295", "-2,147,483,648 … 2,147,483,647"],
          ],
        },
      ],
    },
    {
      id: "gpio",
      title: "GPIO configuration",
      tables: [
        {
          name: "Pin mode outcomes",
          cols: ["Mode", "Internal pull", "Floating input reads", "Typical use"],
          rows: [
            ["Input, no pull", "none", "undefined / noisy", "external divider already biases the line"],
            ["Input, pull-up", "weak pull to Vcc", "reads 1 (high)", "active-low button to ground"],
            ["Input, pull-down", "weak pull to GND", "reads 0 (low)", "active-high button to Vcc"],
            ["Output, push-pull", "n/a", "n/a", "driving an LED or logic input directly"],
            ["Output, open-drain", "n/a (add external pull-up)", "n/a", "shared bus lines (I2C SDA/SCL)"],
          ],
        },
        {
          name: "Bit-manipulation idioms (byte-wide register `R`)",
          cols: ["Goal", "Expression"],
          rows: [
            ["Set bit n", "R \\mathrel{|}= (1 \\ll n)"],
            ["Clear bit n", "R \\mathrel{\\&}= \\sim(1 \\ll n)"],
            ["Toggle bit n", "R \\mathrel{\\wedge}= (1 \\ll n)"],
            ["Test bit n", "(R \\gg n) \\mathrel{\\&} 1"],
          ],
          math: true,
        },
      ],
    },
    {
      id: "timers",
      title: "Timers & PWM",
      formulas: [
        { name: "Timer tick period", tex: "t_{tick} = \\dfrac{\\text{Prescaler}+1}{f_{clk}}" },
        { name: "Overflow / period from tick count", tex: "T = (\\text{ARR}+1)\\cdot t_{tick}" },
        { name: "PWM duty cycle", tex: "D = \\dfrac{T_{on}}{T} \\times 100\\%" },
        { name: "PWM frequency", tex: "f_{PWM} = \\dfrac{1}{T} = \\dfrac{f_{clk}}{(\\text{Prescaler}+1)(\\text{ARR}+1)}" },
        { name: "Compare value for a target duty D", tex: "\\text{CCR} = D \\cdot (\\text{ARR}+1)" },
      ],
    },
    {
      id: "serial",
      title: "Serial communication",
      tables: [
        {
          name: "Common UART baud rates & bit time",
          cols: ["Baud", "Bit time", "8N1 frame time (10 bits)"],
          rows: [
            ["9600", "104.2 µs", "1.042 ms"],
            ["19200", "52.1 µs", "0.521 ms"],
            ["38400", "26.0 µs", "0.260 ms"],
            ["115200", "8.68 µs", "86.8 µs"],
          ],
        },
        {
          name: "Bus comparison",
          cols: ["Bus", "Wires", "Topology", "Addressing", "Typical speed"],
          rows: [
            ["UART", "2 (TX/RX)", "point-to-point", "none", "9.6 kbps – 1 Mbps"],
            ["SPI", "4 (SCLK, MOSI, MISO, CS)", "single master, one CS per slave", "chip-select line", "1 – 50+ Mbps"],
            ["I2C", "2 (SDA, SCL)", "multi-master/multi-slave bus", "7- or 10-bit address", "100 kbps – 3.4 Mbps"],
          ],
        },
        {
          name: "Baud-rate register formula (typical UART)",
          tex: "\\text{BRR} = \\dfrac{f_{clk}}{\\text{Baud}}",
        },
      ],
    },
  ],
});
