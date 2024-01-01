-- Create a database
CREATE DATABASE IF NOT EXISTS gestaoFinanceira;

-- Use the created database
USE gestaoFinanceira;

-- Create a table for user information
CREATE TABLE IF NOT EXISTS Users (
    UserID SERIAL PRIMARY KEY,
    Email VARCHAR(255) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL
);
