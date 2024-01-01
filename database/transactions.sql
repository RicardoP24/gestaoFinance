-- Create a table for user transactions
CREATE TABLE IF NOT EXISTS Transactions (
    TransactionID SERIAL PRIMARY KEY,
    UserID INT REFERENCES Users(UserID),
    Amount DECIMAL(10, 2) NOT NULL,
    Category VARCHAR(255) NOT NULL,
    Date DATE NOT NULL,
    Description VARCHAR(255)
);

