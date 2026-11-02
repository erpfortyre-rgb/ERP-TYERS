import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../data/offline_billing_repository.dart';

class InvoicePrintService {
  static Future<void> print(SavedInvoice invoice) async {
    final document = pw.Document();
    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        build: (context) => [
          pw.Text(
            'SHIV SHANKAR TYRES',
            style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            'Invoice ${invoice.invoiceNumber}',
            style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold),
          ),
          pw.Text('Date: ${invoice.invoiceDate.toLocal()}'),
          pw.Text('Customer: ${invoice.customerName ?? 'Walk-in'}'),
          pw.SizedBox(height: 16),
          pw.TableHelper.fromTextArray(
            headers: const [
              'Product',
              'SKU',
              'Qty',
              'Tier',
              'Unit price',
              'Discount',
              'Tax',
              'Amount',
            ],
            data: invoice.lines
                .map(
                  (line) => [
                    line.name,
                    line.sku,
                    '${line.quantityMilli ~/ 1000}.${(line.quantityMilli % 1000).toString().padLeft(3, '0')}',
                    line.priceTier.label,
                    _money(line.unitPricePaise),
                    _money(line.discountPaise),
                    _money(line.taxPaise),
                    _money(line.totalPaise),
                  ],
                )
                .toList(),
          ),
          pw.SizedBox(height: 16),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Text('Subtotal: ${_money(invoice.subtotalPaise)}'),
          ),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Text('Tax: ${_money(invoice.taxPaise)}'),
          ),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Text(
              'Total: ${_money(invoice.totalPaise)}',
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14),
            ),
          ),
          pw.SizedBox(height: 12),
          pw.Text(
            'Payments (offline recorded; UPI/card entries are unverified):',
          ),
          for (final payment in invoice.payments)
            pw.Text(
              '${payment.method.name.toUpperCase()}: ${_money(payment.amountPaise)}',
            ),
        ],
      ),
    );
    await Printing.layoutPdf(
      name: 'Invoice-${invoice.invoiceNumber}.pdf',
      onLayout: (_) => document.save(),
    );
  }

  static String _money(int paise) =>
      'INR ${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';
}
