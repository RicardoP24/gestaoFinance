const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const http = require('http');
const path = require('path');

const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
require('dotenv').config();
const app = express();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Number of salt rounds

// Start the server
const PORT = 3000;
const PORT_FRONT = 3001;




const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  let contentType = 'text/html';

  // Set the default content type based on the file extension
  const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      // Add more MIME types for additional file extensions
  };

  contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
      if (err) {
          if (err.code === 'ENOENT') {
              // File not found
              fs.readFile('./404.html', (error, content) => {
                  res.writeHead(404, { 'Content-Type': 'text/html' });
                  res.end(content, 'utf-8');
              });
          } else {
              // Some server error
              res.writeHead(500);
              res.end('Sorry, check with the site admin for error: ' + err.code + ' ..\n');
          }
      } else {
          // Successful response
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
      }
  });
});

 

server.listen(PORT_FRONT, () => {
  console.log(`Server is running on http://${process.env.IP}:${PORT_FRONT}`);
});

const pool = new Pool({
  user: String(process.env.DB_USER),
  host: String(process.env.DB_HOST),
  database: String(process.env.DB_NAME),
  password: String(process.env.DB_PASSWORD),
  port: process.env.DB_PORT,
});

pool.connect()


// Middleware to parse JSON requests
app.use(cors());

app.use(bodyParser.json());

const secretKey = process.env.SECRET_KEY; // Use default key if not provided in the environment

 
// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;


  try {
    // Query the database to find a user with the provided email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const hashedPassword = user.password;


      // Compare the provided password with the hashed password from the database
      const passwordMatch = await bcrypt.compare(password, hashedPassword);



      if (passwordMatch) {
        const userID = user.userid;
        const email = user.email;

        // Create a JWT token
        const token = jwt.sign({email }, secretKey, {
          expiresIn: '1h', // Token expiration time
        });

        res.json({ token, userID });
      } else {
        // Passwords do not match
        res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      // No user found with the provided email
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Protected route - requires a valid JWT
app.get('/protected', verifyToken, (req, res) => {
  res.json({ message: 'This is a protected route' });
});

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];

  
  if (!token) {
    return res.status(403).json({ message: 'Token not provided' });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = decoded;
    next();
  });
}

 

app.listen(PORT, () => {
  console.log(`Server is running on http://${process.env.IP}:${PORT}`);
});

 

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the email already exists in the database
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, saltRounds);


    // If the email doesn't exist, insert the new user into the database with the hashed password
    const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);

    const newUser = result.rows[0];

    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/transactions', async (req, res) => {
  try {
    // Assuming the user ID is included in the request as req.query.userId
    const userId = req.query.userId;

    // Query transactions only for the specific user
    const result = await pool.query('SELECT * FROM Transactions WHERE userid = $1', [userId]);

    const transactions = result.rows;

    res.json({ transactions });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.post('/createOrUpdateTransaction', async (req, res) => {
  const { user_id, transaction_id, date, amount, category, description } = req.body;

  try {
    if (transaction_id !== null) {
      // Check if the transaction already exists for the given user ID
      const existingTransaction = await pool.query('SELECT * FROM Transactions WHERE userid = $1 AND transactionid = $2', [user_id, transaction_id]);

      if (existingTransaction.rows.length > 0) {
        // If the transaction exists, update it
        await pool.query(
          'UPDATE Transactions SET date = $1, amount = $2, category = $3, description = $4 WHERE userid = $5 AND transactionid = $6',
          [date, amount, category, description, user_id, transaction_id]
        );

        res.json({ message: 'Transaction updated successfully' });
      } else {
        // If the transaction doesn't exist, respond with an error
        res.status(404).json({ message: 'Transaction not found' });
      }
    } else {
      // If the transaction doesn't exist, create a new one for the given user ID
      await pool.query(
        'INSERT INTO Transactions (userid, date, amount, category, description) VALUES ($1, $2, $3, $4, $5)',
        [user_id, date, amount, category, description]
      );

      res.json({ message: 'Transaction created successfully' });
    }
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
