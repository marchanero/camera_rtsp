const db = require('../database/init-sensors');

class UserController {
  /**
   * Get all users
   * GET /api/users
   */
  async getAllUsers(req, res) {
    try {
      const query = `
        SELECT id, name, subject, card_id, student_id, email, active, last_access, created_at, updated_at
        FROM users
        ORDER BY name ASC
      `;

      db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Error fetching users:', err);
          return res.status(500).json({
            error: 'Failed to fetch users',
            message: err.message
          });
        }

        res.json({
          success: true,
          data: rows,
          count: rows.length
        });
      });
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  async getUser(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT id, name, subject, card_id, student_id, email, active, last_access, created_at, updated_at
        FROM users
        WHERE id = ?
      `;

      db.get(query, [id], (err, row) => {
        if (err) {
          console.error('Error fetching user:', err);
          return res.status(500).json({
            error: 'Failed to fetch user',
            message: err.message
          });
        }

        if (!row) {
          return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${id} not found`
          });
        }

        res.json({
          success: true,
          data: row
        });
      });
    } catch (error) {
      console.error('Error in getUser:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get user by card ID
   * GET /api/users/card/:cardId
   */
  async getUserByCard(req, res) {
    try {
      const { cardId } = req.params;

      const query = `
        SELECT id, name, subject, card_id, student_id, email, active, last_access, created_at, updated_at
        FROM users
        WHERE card_id = ? AND active = 1
      `;

      db.get(query, [cardId], (err, row) => {
        if (err) {
          console.error('Error fetching user by card:', err);
          return res.status(500).json({
            error: 'Failed to fetch user by card',
            message: err.message
          });
        }

        if (!row) {
          return res.status(404).json({
            error: 'User not found',
            message: `No active user found with card ID ${cardId}`
          });
        }

        // Update last access time
        const updateQuery = `UPDATE users SET last_access = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(updateQuery, [row.id], (updateErr) => {
          if (updateErr) {
            console.error('Error updating last access:', updateErr);
          }
        });

        res.json({
          success: true,
          data: row
        });
      });
    } catch (error) {
      console.error('Error in getUserByCard:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Create new user
   * POST /api/users
   */
  async createUser(req, res) {
    try {
      const { name, subject, cardId, studentId, email } = req.body;

      // Validate required fields
      if (!name || !subject) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Name and subject are required'
        });
      }

      // Check for duplicate card_id if provided
      if (cardId) {
        const checkCardQuery = 'SELECT id FROM users WHERE card_id = ?';
        db.get(checkCardQuery, [cardId], (err, existingUser) => {
          if (err) {
            console.error('Error checking card ID:', err);
            return res.status(500).json({
              error: 'Database error',
              message: err.message
            });
          }

          if (existingUser) {
            return res.status(409).json({
              error: 'Duplicate card ID',
              message: 'A user with this card ID already exists'
            });
          }

          // Proceed with user creation
          insertUser();
        });
      } else {
        // Proceed with user creation
        insertUser();
      }

      function insertUser() {
        const query = `
          INSERT INTO users (name, subject, card_id, student_id, email)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.run(query, [name, subject, cardId || null, studentId || null, email || null], function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({
              error: 'Failed to create user',
              message: err.message
            });
          }

          // Fetch the created user
          const selectQuery = `
            SELECT id, name, subject, card_id, student_id, email, active, last_access, created_at, updated_at
            FROM users
            WHERE id = ?
          `;

          db.get(selectQuery, [this.lastID], (selectErr, row) => {
            if (selectErr) {
              console.error('Error fetching created user:', selectErr);
              return res.status(500).json({
                error: 'User created but failed to retrieve',
                message: selectErr.message
              });
            }

            res.status(201).json({
              success: true,
              data: row,
              message: 'User created successfully'
            });
          });
        });
      }
    } catch (error) {
      console.error('Error in createUser:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Update user
   * PUT /api/users/:id
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, subject, cardId, studentId, email, active } = req.body;

      // Validate required fields
      if (!name || !subject) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Name and subject are required'
        });
      }

      // Check if user exists
      const checkQuery = 'SELECT id FROM users WHERE id = ?';
      db.get(checkQuery, [id], (checkErr, existingUser) => {
        if (checkErr) {
          console.error('Error checking user existence:', checkErr);
          return res.status(500).json({
            error: 'Database error',
            message: checkErr.message
          });
        }

        if (!existingUser) {
          return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${id} not found`
          });
        }

        // Check for duplicate card_id if provided
        if (cardId) {
          const checkCardQuery = 'SELECT id FROM users WHERE card_id = ? AND id != ?';
          db.get(checkCardQuery, [cardId, id], (cardErr, existingCardUser) => {
            if (cardErr) {
              console.error('Error checking card ID:', cardErr);
              return res.status(500).json({
                error: 'Database error',
                message: cardErr.message
              });
            }

            if (existingCardUser) {
              return res.status(409).json({
                error: 'Duplicate card ID',
                message: 'Another user with this card ID already exists'
              });
            }

            // Proceed with user update
            updateUser();
          });
        } else {
          // Proceed with user update
          updateUser();
        }

        function updateUser() {
          const query = `
            UPDATE users
            SET name = ?, subject = ?, card_id = ?, student_id = ?, email = ?, active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;

          db.run(query, [name, subject, cardId || null, studentId || null, email || null, active !== undefined ? active : 1, id], function(err) {
            if (err) {
              console.error('Error updating user:', err);
              return res.status(500).json({
                error: 'Failed to update user',
                message: err.message
              });
            }

            if (this.changes === 0) {
              return res.status(404).json({
                error: 'User not found',
                message: `User with ID ${id} not found`
              });
            }

            // Fetch the updated user
            const selectQuery = `
              SELECT id, name, subject, card_id, student_id, email, active, last_access, created_at, updated_at
              FROM users
              WHERE id = ?
            `;

            db.get(selectQuery, [id], (selectErr, row) => {
              if (selectErr) {
                console.error('Error fetching updated user:', selectErr);
                return res.status(500).json({
                  error: 'User updated but failed to retrieve',
                  message: selectErr.message
                });
              }

              res.json({
                success: true,
                data: row,
                message: 'User updated successfully'
              });
            });
          });
        }
      });
    } catch (error) {
      console.error('Error in updateUser:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Check if user exists
      const checkQuery = 'SELECT id FROM users WHERE id = ?';
      db.get(checkQuery, [id], (checkErr, existingUser) => {
        if (checkErr) {
          console.error('Error checking user existence:', checkErr);
          return res.status(500).json({
            error: 'Database error',
            message: checkErr.message
          });
        }

        if (!existingUser) {
          return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${id} not found`
          });
        }

        // Soft delete by setting active to false
        const query = 'UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

        db.run(query, [id], function(err) {
          if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({
              error: 'Failed to delete user',
              message: err.message
            });
          }

          res.json({
            success: true,
            message: 'User deleted successfully'
          });
        });
      });
    } catch (error) {
      console.error('Error in deleteUser:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = new UserController();