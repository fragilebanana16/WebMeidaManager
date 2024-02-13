// todo1
CREATE DATABASE perntodo;

CREATE TABLE todolist(
  todo_id SERIAL PRIMARY KEY,
  description VARCHAR(255)
);

// todo2
ALTER TABLE todolist
ADD title VARCHAR(255);

// todo3
ALTER TABLE todolist
ADD done BOOLEAN;

// todo3
ALTER TABLE todolist
ADD createdTime TIMESTAMP,
ADD finishedTime TIMESTAMP;
