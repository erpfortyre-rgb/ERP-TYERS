package printing

import (
	"fmt"
	"net"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	winspool          = windows.NewLazyDLL("winspool.drv")
	openPrinterW      = winspool.NewProc("OpenPrinterW")
	closePrinter      = winspool.NewProc("ClosePrinter")
	startDocPrinterW  = winspool.NewProc("StartDocPrinterW")
	endDocPrinter     = winspool.NewProc("EndDocPrinter")
	startPagePrinter  = winspool.NewProc("StartPagePrinter")
	endPagePrinter    = winspool.NewProc("EndPagePrinter")
	writePrinter      = winspool.NewProc("WritePrinter")
)

type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

func SendToWindowsRAW(printerName string, data []byte) error {
	if len(data) == 0 {
		return nil
	}

	pName, err := windows.UTF16PtrFromString(printerName)
	if err != nil {
		return fmt.Errorf("invalid printer name: %w", err)
	}

	var hPrinter uintptr
	ret, _, _ := openPrinterW.Call(
		uintptr(unsafe.Pointer(pName)),
		uintptr(unsafe.Pointer(&hPrinter)),
		0,
	)
	if ret == 0 {
		return fmt.Errorf("OpenPrinter failed for '%s'", printerName)
	}
	defer closePrinter.Call(hPrinter)

	docName, _ := windows.UTF16PtrFromString("SST Receipt")
	dataType, _ := windows.UTF16PtrFromString("RAW")

	di := docInfo1{
		pDocName:    docName,
		pOutputFile: nil,
		pDatatype:   dataType,
	}

	ret, _, _ = startDocPrinterW.Call(
		hPrinter,
		1,
		uintptr(unsafe.Pointer(&di)),
	)
	if ret == 0 {
		return fmt.Errorf("StartDocPrinter failed")
	}
	defer endDocPrinter.Call(hPrinter)

	ret, _, _ = startPagePrinter.Call(hPrinter)
	if ret == 0 {
		return fmt.Errorf("StartPagePrinter failed")
	}
	defer endPagePrinter.Call(hPrinter)

	var written uint32
	ret, _, _ = writePrinter.Call(
		hPrinter,
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&written)),
	)
	if ret == 0 {
		return fmt.Errorf("WritePrinter failed")
	}
	if int(written) != len(data) {
		return fmt.Errorf("WritePrinter: wrote %d of %d bytes", written, len(data))
	}

	return nil
}

func SendToTCP(address string, data []byte) error {
	if len(data) == 0 {
		return nil
	}

	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		return fmt.Errorf("TCP connect to %s: %w", address, err)
	}
	defer conn.Close()

	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	total := 0
	for total < len(data) {
		n, err := conn.Write(data[total:])
		if err != nil {
			return fmt.Errorf("TCP write: %w", err)
		}
		total += n
	}

	return nil
}
