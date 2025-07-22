import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root directory
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Create PostgreSQL pool following auth.ts pattern
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb',
});

// Custom error classes
export class PersonServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PersonServiceError';
  }
}

export class PersonNotFoundError extends PersonServiceError {
  constructor(message: string = 'Person not found') {
    super(message, 'PERSON_NOT_FOUND');
    this.name = 'PersonNotFoundError';
  }
}

export class DuplicateEmailError extends PersonServiceError {
  constructor(email: string) {
    super(`Email address ${email} already exists`, 'DUPLICATE_EMAIL');
    this.name = 'DuplicateEmailError';
  }
}

export class UnauthorizedError extends PersonServiceError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class InvalidRelationshipError extends PersonServiceError {
  constructor(relationshipType: string) {
    super(`Invalid relationship type: ${relationshipType}`, 'INVALID_RELATIONSHIP');
    this.name = 'InvalidRelationshipError';
  }
}

export class ValidationError extends PersonServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// TypeScript interfaces for the PersonService

export interface Person {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface PersonEmail {
  id: string;
  person_id: string;
  email_address: string;
  is_primary: boolean;
  created_at: Date;
}

export interface PersonRelationship {
  id: string;
  user_id: string;
  person_id: string;
  relationship_type: string;
  is_primary: boolean;
  user_set: boolean;
  confidence: number;
  created_at: Date;
  updated_at: Date;
}

export interface PersonWithDetails extends Person {
  emails: PersonEmail[];
  relationships: PersonRelationship[];
}

export interface CreatePersonParams {
  userId: string;
  name: string;
  emailAddress: string;
  relationshipType?: string;
  confidence?: number;
}

export interface ListPeopleParams {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface MergePeopleParams {
  userId: string;
  sourcePersonId: string;
  targetPersonId: string;
}

export class PersonService {
  private pool: Pool;
  private readonly MAX_NAME_LENGTH = 255;
  private readonly MAX_EMAIL_LENGTH = 255;
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private suppressLogs = false;

  constructor(customPool?: Pool) {
    this.pool = customPool || pool;
    // Suppress logs during tests
    if (process.env.NODE_ENV === 'test') {
      this.suppressLogs = true;
    }
  }

  async initialize(): Promise<void> {
    // Test database connection
    try {
      await this.pool.query('SELECT 1');
      if (!this.suppressLogs) {
        console.log('PersonService: Database connection verified');
      }
    } catch (error) {
      console.error('PersonService: Failed to connect to database', error);
      throw new PersonServiceError('Failed to connect to database', 'DB_CONNECTION_ERROR');
    }
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required');
    }
    
    const normalizedEmail = this._normalizeEmail(email);
    
    if (normalizedEmail.length > this.MAX_EMAIL_LENGTH) {
      throw new ValidationError(`Email must be ${this.MAX_EMAIL_LENGTH} characters or less`);
    }
    
    if (!this.EMAIL_REGEX.test(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }
  }

  /**
   * Validate person name
   */
  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Name is required');
    }
    
    const trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      throw new ValidationError('Name cannot be empty');
    }
    
    if (trimmedName.length > this.MAX_NAME_LENGTH) {
      throw new ValidationError(`Name must be ${this.MAX_NAME_LENGTH} characters or less`);
    }
  }

  /**
   * Validate UUID format
   */
  private validateUUID(id: string, fieldName: string): void {
    // Allow standard UUID v4 format or all zeros for testing
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new ValidationError(`Invalid ${fieldName} format`);
    }
  }

  /**
   * Log operation for debugging
   */
  private logOperation(operation: string, userId: string, details?: any): void {
    if (!this.suppressLogs) {
      console.log(`PersonService.${operation}:`, {
        userId,
        timestamp: new Date().toISOString(),
        ...details
      });
    }
  }

  async createPerson(params: CreatePersonParams): Promise<PersonWithDetails> {
    // Validate inputs
    if (!params.userId) {
      throw new ValidationError('User ID is required');
    }
    
    this.validateName(params.name);
    this.validateEmail(params.emailAddress);
    
    if (params.confidence !== undefined && (params.confidence < 0 || params.confidence > 1)) {
      throw new ValidationError('Confidence must be between 0 and 1');
    }
    
    const client = await this._beginTransaction();
    
    try {
      this.logOperation('createPerson', params.userId, { name: params.name, email: params.emailAddress });
      
      // Check if email already exists for this user
      const normalizedEmail = this._normalizeEmail(params.emailAddress);
      const emailCheck = await client.query(
        `SELECT p.id, p.name 
         FROM people p
         INNER JOIN person_emails pe ON pe.person_id = p.id
         WHERE pe.email_address = $1 AND p.user_id = $2`,
        [normalizedEmail, params.userId]
      );
      
      if (emailCheck.rows.length > 0) {
        throw new DuplicateEmailError(normalizedEmail);
      }
      
      // Create the person
      const personResult = await client.query(
        `INSERT INTO people (user_id, name, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id, user_id, name, created_at, updated_at`,
        [params.userId, params.name.trim()]
      );
      
      const person = personResult.rows[0];
      
      // Add the primary email
      const emailResult = await client.query(
        `INSERT INTO person_emails (person_id, email_address, is_primary, created_at)
         VALUES ($1, $2, true, NOW())
         RETURNING id, person_id, email_address, is_primary, created_at`,
        [person.id, normalizedEmail]
      );
      
      const email = emailResult.rows[0];
      
      // Add relationship if provided
      let relationship = null;
      if (params.relationshipType) {
        // Verify the relationship type exists for this user
        const relationshipCheck = await client.query(
          `SELECT relationship_type FROM user_relationships 
           WHERE user_id = $1 AND relationship_type = $2 AND is_active = true`,
          [params.userId, params.relationshipType]
        );
        
        if (relationshipCheck.rows.length === 0) {
          throw new InvalidRelationshipError(params.relationshipType);
        }
        
        const relationshipResult = await client.query(
          `INSERT INTO person_relationships 
           (user_id, person_id, relationship_type, is_primary, user_set, confidence, created_at, updated_at)
           VALUES ($1, $2, $3, true, false, $4, NOW(), NOW())
           RETURNING id, user_id, person_id, relationship_type, is_primary, user_set, confidence, created_at, updated_at`,
          [params.userId, person.id, params.relationshipType, params.confidence || 0.5]
        );
        
        relationship = relationshipResult.rows[0];
      }
      
      await this._commitTransaction(client);
      
      // Return the complete person object
      return {
        ...person,
        emails: [email],
        relationships: relationship ? [relationship] : []
      };
    } catch (error) {
      await this._rollbackTransaction(client);
      
      // Re-throw our custom errors as-is
      if (error instanceof PersonServiceError) {
        throw error;
      }
      
      // Wrap database errors
      if (error instanceof Error && 'code' in error) {
        const pgError = error as any;
        if (pgError.code === '23505') { // Unique violation
          throw new DuplicateEmailError(params.emailAddress);
        }
      }
      
      throw new PersonServiceError(`Failed to create person: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CREATE_FAILED');
    }
  }

  async addEmailToPerson(personId: string, emailAddress: string, userId: string): Promise<PersonWithDetails> {
    // Validate inputs
    if (!userId) {
      throw new ValidationError('User ID is required');
    }
    
    this.validateUUID(personId, 'person ID');
    this.validateEmail(emailAddress);
    
    const client = await this._beginTransaction();
    
    try {
      this.logOperation('addEmailToPerson', userId, { personId, email: emailAddress });
      
      // Verify person belongs to user
      const personCheck = await client.query(
        `SELECT id, name FROM people WHERE id = $1 AND user_id = $2`,
        [personId, userId]
      );
      
      if (personCheck.rows.length === 0) {
        throw new PersonNotFoundError(`Person ${personId} not found or unauthorized`);
      }
      
      // Check if email already exists for this person
      const normalizedEmail = this._normalizeEmail(emailAddress);
      const emailCheck = await client.query(
        `SELECT id FROM person_emails WHERE person_id = $1 AND email_address = $2`,
        [personId, normalizedEmail]
      );
      
      if (emailCheck.rows.length > 0) {
        throw new DuplicateEmailError(normalizedEmail);
      }
      
      // Check if email exists for another person under this user
      const emailExistsCheck = await client.query(
        `SELECT p.id, p.name 
         FROM people p
         INNER JOIN person_emails pe ON pe.person_id = p.id
         WHERE pe.email_address = $1 AND p.user_id = $2 AND p.id != $3`,
        [normalizedEmail, userId, personId]
      );
      
      if (emailExistsCheck.rows.length > 0) {
        const existingPerson = emailExistsCheck.rows[0];
        throw new DuplicateEmailError(
          `${normalizedEmail} (already assigned to ${existingPerson.name})`
        );
      }
      
      // Add the new email
      await client.query(
        `INSERT INTO person_emails (person_id, email_address, is_primary, created_at)
         VALUES ($1, $2, false, NOW())`,
        [personId, normalizedEmail]
      );
      
      await this._commitTransaction(client);
      
      // Return updated person with all details
      const result = await this.getPersonWithEmails(personId, userId);
      if (!result) {
        throw new PersonNotFoundError(`Failed to retrieve person after adding email`);
      }
      
      return result;
    } catch (error) {
      await this._rollbackTransaction(client);
      
      if (error instanceof PersonServiceError) {
        throw error;
      }
      
      throw new PersonServiceError(`Failed to add email: ${error instanceof Error ? error.message : 'Unknown error'}`, 'ADD_EMAIL_FAILED');
    }
  }

  async findPersonByEmail(emailAddress: string, userId: string): Promise<PersonWithDetails | null> {
    // Validate inputs
    if (!userId) {
      throw new ValidationError('User ID is required');
    }
    
    this.validateEmail(emailAddress);
    
    try {
      this.logOperation('findPersonByEmail', userId, { email: emailAddress });
      
      const normalizedEmail = this._normalizeEmail(emailAddress);
      
      // Find person by email
      const result = await this.pool.query(
        `SELECT p.id
         FROM people p
         INNER JOIN person_emails pe ON pe.person_id = p.id
         WHERE pe.email_address = $1 AND p.user_id = $2
         LIMIT 1`,
        [normalizedEmail, userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Get full person details
      return await this.getPersonWithEmails(result.rows[0].id, userId);
    } catch (error) {
      if (error instanceof PersonServiceError) {
        throw error;
      }
      
      throw new PersonServiceError(`Failed to find person by email: ${error instanceof Error ? error.message : 'Unknown error'}`, 'FIND_FAILED');
    }
  }

  async getPersonWithEmails(personId: string, userId: string): Promise<PersonWithDetails | null> {
    // Validate inputs
    if (!userId) {
      throw new ValidationError('User ID is required');
    }
    
    this.validateUUID(personId, 'person ID');
    
    try {
      this.logOperation('getPersonWithEmails', userId, { personId });
      
      // Get person details
      const personResult = await this.pool.query(
        `SELECT id, user_id, name, created_at, updated_at
         FROM people
         WHERE id = $1 AND user_id = $2`,
        [personId, userId]
      );
      
      if (personResult.rows.length === 0) {
        return null;
      }
      
      const person = personResult.rows[0];
      
      // Get all emails for this person
      const emailsResult = await this.pool.query(
        `SELECT id, person_id, email_address, is_primary, created_at
         FROM person_emails
         WHERE person_id = $1
         ORDER BY is_primary DESC, created_at ASC`,
        [personId]
      );
      
      // Get all relationships for this person
      const relationshipsResult = await this.pool.query(
        `SELECT pr.id, pr.user_id, pr.person_id, pr.relationship_type, 
                pr.is_primary, pr.user_set, pr.confidence, pr.created_at, pr.updated_at
         FROM person_relationships pr
         WHERE pr.person_id = $1 AND pr.user_id = $2
         ORDER BY pr.is_primary DESC, pr.confidence DESC`,
        [personId, userId]
      );
      
      return {
        ...person,
        emails: emailsResult.rows,
        relationships: relationshipsResult.rows
      };
    } catch (error) {
      if (error instanceof PersonServiceError) {
        throw error;
      }
      
      throw new PersonServiceError(`Failed to get person details: ${error instanceof Error ? error.message : 'Unknown error'}`, 'GET_FAILED');
    }
  }

  async listPeopleForUser(params: ListPeopleParams): Promise<PersonWithDetails[]> {
    // Validate inputs
    if (!params.userId) {
      throw new ValidationError('User ID is required');
    }
    
    const limit = Math.min(Math.max(params.limit || 50, 1), 100); // Between 1 and 100
    const offset = Math.max(params.offset || 0, 0); // Non-negative
    
    try {
      this.logOperation('listPeopleForUser', params.userId, { limit, offset });
      
      // Get people with their primary email and relationship
      const result = await this.pool.query(
        `SELECT 
          p.id, p.user_id, p.name, p.created_at, p.updated_at,
          pe.email_address as primary_email,
          pr.relationship_type as primary_relationship,
          pr.confidence as relationship_confidence,
          pr.user_set as relationship_user_set,
          COUNT(DISTINCT pe_all.id) as email_count,
          COUNT(DISTINCT pr_all.id) as relationship_count
         FROM people p
         LEFT JOIN person_emails pe ON pe.person_id = p.id AND pe.is_primary = true
         LEFT JOIN person_relationships pr ON pr.person_id = p.id AND pr.is_primary = true AND pr.user_id = p.user_id
         LEFT JOIN person_emails pe_all ON pe_all.person_id = p.id
         LEFT JOIN person_relationships pr_all ON pr_all.person_id = p.id AND pr_all.user_id = p.user_id
         WHERE p.user_id = $1
         GROUP BY p.id, p.user_id, p.name, p.created_at, p.updated_at, 
                  pe.email_address, pr.relationship_type, pr.confidence, pr.user_set
         ORDER BY p.name ASC
         LIMIT $2 OFFSET $3`,
        [params.userId, limit, offset]
      );
      
      // For each person, get their full details
      const people: PersonWithDetails[] = [];
      for (const row of result.rows) {
        const person = await this.getPersonWithEmails(row.id, params.userId);
        if (person) {
          people.push(person);
        }
      }
      
      return people;
    } catch (error) {
      if (error instanceof PersonServiceError) {
        throw error;
      }
      
      throw new PersonServiceError(`Failed to list people: ${error instanceof Error ? error.message : 'Unknown error'}`, 'LIST_FAILED');
    }
  }

  async mergePeople(params: MergePeopleParams): Promise<PersonWithDetails> {
    // Validate inputs
    if (!params.userId) {
      throw new ValidationError('User ID is required');
    }
    
    this.validateUUID(params.sourcePersonId, 'source person ID');
    this.validateUUID(params.targetPersonId, 'target person ID');
    
    if (params.sourcePersonId === params.targetPersonId) {
      throw new ValidationError('Cannot merge a person with themselves');
    }
    
    const client = await this._beginTransaction();
    
    try {
      this.logOperation('mergePeople', params.userId, {
        sourcePersonId: params.sourcePersonId,
        targetPersonId: params.targetPersonId
      });
      
      // Verify both people belong to the user
      const peopleCheck = await client.query(
        `SELECT id, name FROM people 
         WHERE user_id = $1 AND id IN ($2, $3)`,
        [params.userId, params.sourcePersonId, params.targetPersonId]
      );
      
      if (peopleCheck.rows.length !== 2) {
        throw new PersonNotFoundError('One or both people not found or unauthorized');
      }
      
      // Move all emails from source to target (skip duplicates)
      await client.query(
        `INSERT INTO person_emails (person_id, email_address, is_primary, created_at)
         SELECT $1, email_address, false, created_at
         FROM person_emails
         WHERE person_id = $2
         AND email_address NOT IN (
           SELECT email_address FROM person_emails WHERE person_id = $1
         )`,
        [params.targetPersonId, params.sourcePersonId]
      );
      
      // Merge relationships - for each relationship type, keep the one with highest confidence or user_set
      const relationshipsResult = await client.query(
        `SELECT DISTINCT relationship_type
         FROM person_relationships
         WHERE person_id IN ($1, $2) AND user_id = $3`,
        [params.sourcePersonId, params.targetPersonId, params.userId]
      );
      
      // First, remove primary flags from target person's relationships to avoid constraint violation
      await client.query(
        `UPDATE person_relationships
         SET is_primary = false
         WHERE person_id = $1 AND user_id = $2`,
        [params.targetPersonId, params.userId]
      );
      
      for (const row of relationshipsResult.rows) {
        const relationshipType = row.relationship_type;
        
        // Get the best relationship for this type (prefer user_set, then highest confidence)
        const bestRelationship = await client.query(
          `SELECT person_id, is_primary, user_set, confidence
           FROM person_relationships
           WHERE person_id IN ($1, $2) AND user_id = $3 AND relationship_type = $4
           ORDER BY user_set DESC, confidence DESC
           LIMIT 1`,
          [params.sourcePersonId, params.targetPersonId, params.userId, relationshipType]
        );
        
        if (bestRelationship.rows.length > 0) {
          const best = bestRelationship.rows[0];
          
          // Delete any existing relationship of this type for the target
          await client.query(
            `DELETE FROM person_relationships
             WHERE person_id = $1 AND user_id = $2 AND relationship_type = $3`,
            [params.targetPersonId, params.userId, relationshipType]
          );
          
          // Insert the best relationship for the target (without is_primary flag initially)
          await client.query(
            `INSERT INTO person_relationships 
             (user_id, person_id, relationship_type, is_primary, user_set, confidence, created_at, updated_at)
             VALUES ($1, $2, $3, false, $4, $5, NOW(), NOW())`,
            [params.userId, params.targetPersonId, relationshipType, best.user_set, best.confidence]
          );
        }
      }
      
      // Ensure at least one relationship is marked as primary
      await client.query(
        `UPDATE person_relationships
         SET is_primary = true
         WHERE person_id = $1 AND user_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM person_relationships 
           WHERE person_id = $1 AND user_id = $2 AND is_primary = true
         )
         AND id = (
           SELECT id FROM person_relationships
           WHERE person_id = $1 AND user_id = $2
           ORDER BY user_set DESC, confidence DESC
           LIMIT 1
         )`,
        [params.targetPersonId, params.userId]
      );
      
      // Delete the source person (cascades to emails and relationships)
      await client.query(
        `DELETE FROM people WHERE id = $1 AND user_id = $2`,
        [params.sourcePersonId, params.userId]
      );
      
      // Update the target person's updated_at timestamp
      await client.query(
        `UPDATE people SET updated_at = NOW() WHERE id = $1`,
        [params.targetPersonId]
      );
      
      await this._commitTransaction(client);
      
      // Return the merged person
      const mergedPerson = await this.getPersonWithEmails(params.targetPersonId, params.userId);
      if (!mergedPerson) {
        throw new PersonNotFoundError('Failed to retrieve merged person');
      }
      
      return mergedPerson;
    } catch (error) {
      await this._rollbackTransaction(client);
      
      if (error instanceof PersonServiceError) {
        throw error;
      }
      
      // Handle specific database errors
      if (error instanceof Error && 'code' in error) {
        const pgError = error as any;
        if (pgError.code === '23505') { // Unique violation
          throw new PersonServiceError('Merge conflict: duplicate data detected', 'MERGE_CONFLICT');
        }
      }
      
      throw new PersonServiceError(`Failed to merge people: ${error instanceof Error ? error.message : 'Unknown error'}`, 'MERGE_FAILED');
    }
  }

  /**
   * Helper method to normalize email addresses
   */
  private _normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Helper method to begin a database transaction
   */
  private async _beginTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Helper method to commit a transaction
   */
  private async _commitTransaction(client: any) {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Helper method to rollback a transaction
   */
  private async _rollbackTransaction(client: any) {
    await client.query('ROLLBACK');
    client.release();
  }
}

// Create and export singleton instance
export const personService = new PersonService();