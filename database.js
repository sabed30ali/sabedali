const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./shopzone.db');

// Initialize Database Tables
db.serialize(() => {
    console.log('📦 Setting up database...');

    // Users Table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Products Table
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            old_price REAL,
            rating REAL DEFAULT 4.0,
            image TEXT NOT NULL,
            badge TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Cart Items Table
    db.run(`
        CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    // Orders Table
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Order Items Table
    db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    // Seed initial products if empty
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            console.log('🌱 Seeding products...');
            const products = [
                ["Premium Cotton T-Shirt", "Fashion", 29.99, 49.99, 4.5, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", "Sale"],
                ["Classic Denim Jeans", "Fashion", 59.99, 89.99, 4.8, "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400", "Best Seller"],
                ["Wireless Headphones", "Electronics", 149.99, 199.99, 4.7, "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400", "New"],
                ["Running Sneakers", "Footwear", 89.99, 129.99, 4.6, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", "Hot"],
                ["Leather Wallet", "Accessories", 39.99, 59.99, 4.4, "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400", null],
                ["Smart Watch Series 8", "Electronics", 299.99, 399.99, 4.9, "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400", "Limited"],
                ["Designer Sunglasses", "Accessories", 79.99, 119.99, 4.3, "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400", null],
                ["Casual Hoodie", "Fashion", 49.99, 79.99, 4.5, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", "Popular"]
            ];
            
            const stmt = db.prepare("INSERT INTO products (name, category, price, old_price, rating, image, badge) VALUES (?, ?, ?, ?, ?, ?, ?)");
            products.forEach(p => stmt.run(p));
            stmt.finalize();
            console.log('✅ Products seeded!');
        }
    });

    console.log('✅ Database ready!');
});

module.exports = db;