import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Billing screen ka dhancha (abhi sirf dikhawat, logic baad me).
class BillingScreen extends StatelessWidget {
  const BillingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _HeaderRow(),
          SizedBox(height: 12),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _ItemsPanel()),
                SizedBox(width: 12),
                SizedBox(width: 300, child: _SummaryPanel()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderRow extends StatelessWidget {
  const _HeaderRow();

  Widget _field(String label, {String? text, int flex = 1}) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.only(right: 10),
        child: TextField(
          controller: TextEditingController(text: text),
          decoration: InputDecoration(labelText: label),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _field('Invoice No', text: 'C1-26-0001'),
        _field('Date'),
        _field('Customer', flex: 2),
        _field('Rate Tier', text: 'MRP'),
      ],
    );
  }
}

class _ItemsPanel extends StatelessWidget {
  const _ItemsPanel();

  static const _columns = <(String, int)>[
    ('#', 1),
    ('Item', 6),
    ('Qty', 2),
    ('Rate', 2),
    ('Disc', 2),
    ('GST %', 2),
    ('Amount', 3),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Container(
            color: AppColors.background,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                for (final c in _columns)
                  Expanded(
                    flex: c.$2,
                    child: Text(
                      c.$1,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          const Expanded(
            child: Center(
              child: Text(
                'Item code type karo ya F2 dabao',
                style: TextStyle(color: AppColors.textMuted),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryPanel extends StatelessWidget {
  const _SummaryPanel();

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label), Text(value)],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _row('Sub Total', '₹ 0.00'),
          _row('GST', '₹ 0.00'),
          _row('Round off', '₹ 0.00'),
          const Divider(),
          const Text('Payable', style: TextStyle(color: AppColors.textMuted)),
          const Text(
            '₹ 0.00',
            style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
              ),
              child: const Text(
                'UPI QR yahan aayega',
                style: TextStyle(color: AppColors.textMuted),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Cash  |  UPI  |  Card  |  Credit',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
