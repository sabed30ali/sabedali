const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: "Email already registered" });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    success: true, 
                    user: { id: this.lastID, name, email } 
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });
        
        res.json({ 
            success: true, 
            user: { id: user.id, name: user.name, email: user.email } 
        });
    });
});

// Get User Profile
app.get('/api/user/:id', (req, res) => {
    db.get("SELECT id, name, email, created_at FROM users WHERE id = ?", [req.params.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    });
});

// ==================== PRODUCTS ROUTES ====================

// Get All Products
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY id DESC", [], (err, products) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(products);
    });
});

// Get Single Product
app.get('/api/products/:id', (req, res) => {
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(product);
    });
});

// ==================== CART ROUTES ====================

// Get User Cart
app.get('/api/cart/:userId', (req, res) => {
    const sql = `
        SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image 
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `;
    db.all(sql, [req.params.userId], (err, items) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(items);
    });
});

// Add to Cart
app.post('/api/cart', (req, res) => {
    const { userId, productId, quantity = 1 } = req.body;
    
    // Check if item exists in cart
    db.get(
        "SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?",
        [userId, productId],
        (err, existingItem) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (existingItem) {
                // Update quantity
                db.run(
                    "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
                    [quantity, existingItem.id],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true, message: "Cart updated" });
                    }
                );
            } else {
                // Insert new item
                db.run(
                    "INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)",
                    [userId, productId, quantity],
                    function(err) {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true, message: "Added to cart" });
                    }
                );
            }
        }
    );
});

// Update Cart Quantity
app.put('/api/cart/:id', (req, res) => {
    const { quantity } = req.body;
    
    if (quantity <= 0) {
        db.run("DELETE FROM cart_items WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        db.run(
            "UPDATE cart_items SET quantity = ? WHERE id = ?",
            [quantity, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            }
        );
    }
});

// Remove from Cart
app.delete('/api/cart/:id', (req, res) => {
    db.run("DELETE FROM cart_items WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Clear Cart
app.delete('/api/cart/user/:userId', (req, res) => {
    db.run("DELETE FROM cart_items WHERE user_id = ?", [req.params.userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== ORDER ROUTES ====================

// Create Order (Checkout)
app.post('/api/orders', (req, res) => {
    const { userId, items, total } = req.body;
    
    db.serialize(() => {
        // Create order
        db.run(
            "INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)",
            [userId, total, 'processing'],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                const orderId = this.lastID;
                
                // Add order items
                const stmt = db.prepare(
                    "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)"
                );
                
                items.forEach(item => {
                    stmt.run(orderId, item.product_id, item.quantity, item.price);
                });
                stmt.finalize();
                
                // Clear cart
                db.run("DELETE FROM cart_items WHERE user_id = ?", [userId]);
                
                res.json({ success: true, orderId });
            }
        );
    });
});

// Get User Orders
app.get('/api/orders/user/:userId', (req, res) => {
    const sql = `
        SELECT o.*, oi.product_id, oi.quantity, oi.price, p.name as product_name, p.image
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
    `;
    db.all(sql, [req.params.userId], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(orders);
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});