import 'item.dart';

abstract interface class ItemsRepository {
  Future<List<Product>> searchProducts({
    String query,
    String? category,
    bool? activeOnly,
  });

  Future<Product?> getProduct(String id);

  Future<Product?> findBySku(String sku);

  Future<Product?> findByBarcode(String barcode);

  Future<List<String>> categories();

  Future<List<ProductPrice>> priceHistory(String productId);

  Future<Map<PriceTier, int>> currentPrices(String productId);

  Future<void> saveProduct(ProductDraft draft);
}
