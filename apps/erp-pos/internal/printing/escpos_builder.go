package printing

import (
	"bytes"
	"fmt"
	"strings"
)

const (
	escInit       = "\x1B\x40"
	escCenterOn   = "\x1B\x61\x01"
	escCenterOff  = "\x1B\x61\x00"
	escBoldOn     = "\x1B\x45\x01"
	escBoldOff    = "\x1B\x45\x00"
	escDoubleOn   = "\x1D\x21\x11"
	escDoubleOff  = "\x1D\x21\x00"
	escCut        = "\x1D\x56\x00"
	escPartialCut = "\x1D\x56\x01"
	escLF         = "\x0A"
)

type ESCPOSBuilder struct {
	buf       bytes.Buffer
	colWidth  int
}

func NewESCPOSBuilder(paperWidthMM int) *ESCPOSBuilder {
	cols := 48
	if paperWidthMM <= 58 {
		cols = 32
	}
	return &ESCPOSBuilder{colWidth: cols}
}

func (b *ESCPOSBuilder) Init() {
	b.buf.WriteString(escInit)
}

func (b *ESCPOSBuilder) CenterText(text string) {
	b.buf.WriteString(escCenterOn)
	b.buf.WriteString(truncate(text, b.colWidth))
	b.buf.WriteString(escLF)
	b.buf.WriteString(escCenterOff)
}

func (b *ESCPOSBuilder) CenterBold(text string) {
	b.buf.WriteString(escCenterOn)
	b.buf.WriteString(escDoubleOn)
	b.buf.WriteString(truncate(text, b.colWidth/2))
	b.buf.WriteString(escLF)
	b.buf.WriteString(escDoubleOff)
	b.buf.WriteString(escCenterOff)
}

func (b *ESCPOSBuilder) LeftText(text string) {
	b.buf.WriteString(truncate(text, b.colWidth))
	b.buf.WriteString(escLF)
}

func (b *ESCPOSBuilder) LeftRight(left, right string) {
	gap := b.colWidth - len(left) - len(right)
	if gap < 1 {
		gap = 1
	}
	b.buf.WriteString(left)
	b.buf.WriteString(strings.Repeat(" ", gap))
	b.buf.WriteString(right)
	b.buf.WriteString(escLF)
}

func (b *ESCPOSBuilder) LeftRightBold(left, right string) {
	b.buf.WriteString(escBoldOn)
	b.LeftRight(left, right)
	b.buf.WriteString(escBoldOff)
}

func (b *ESCPOSBuilder) Separator(ch byte) {
	b.buf.WriteString(strings.Repeat(string(ch), b.colWidth))
	b.buf.WriteString(escLF)
}

func (b *ESCPOSBuilder) LineFeed() {
	b.buf.WriteString(escLF)
}

func (b *ESCPOSBuilder) ItemHeader() {
	nameW := b.colWidth - 22
	line := padRight("Item", nameW) + padRight("Qty", 6) + padRight("Rate", 8) + padLeft("Amt", 8)
	b.buf.WriteString(escBoldOn)
	b.buf.WriteString(line)
	b.buf.WriteString(escLF)
	b.buf.WriteString(escBoldOff)
}

func (b *ESCPOSBuilder) ItemLine(name string, qty, rate, total float64) {
	nameW := b.colWidth - 22
	if len(name) > nameW {
		b.buf.WriteString(name[:nameW])
		b.buf.WriteString(escLF)
		b.buf.WriteString(strings.Repeat(" ", nameW))
	} else {
		b.buf.WriteString(padRight(name, nameW))
	}

	qtyStr := formatFloat(qty)
	rateStr := formatFloat(rate)
	totalStr := formatFloat(total)

	b.buf.WriteString(padRight(qtyStr, 6))
	b.buf.WriteString(padRight(rateStr, 8))
	b.buf.WriteString(padLeft(totalStr, 8))
	b.buf.WriteString(escLF)
}

func (b *ESCPOSBuilder) Cut() {
	b.buf.WriteString(escLF)
	b.buf.WriteString(escLF)
	b.buf.WriteString(escLF)
	b.buf.WriteString(escPartialCut)
}

func (b *ESCPOSBuilder) Bytes() []byte {
	return b.buf.Bytes()
}

func truncate(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}

func padRight(s string, width int) string {
	if len(s) >= width {
		return s[:width]
	}
	return s + strings.Repeat(" ", width-len(s))
}

func padLeft(s string, width int) string {
	if len(s) >= width {
		return s[:width]
	}
	return strings.Repeat(" ", width-len(s)) + s
}

func formatFloat(v float64) string {
	if v == float64(int64(v)) {
		return fmt.Sprintf("%d", int64(v))
	}
	return fmt.Sprintf("%.2f", v)
}
