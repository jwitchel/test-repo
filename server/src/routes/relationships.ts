import { Router, Request, Response } from 'express';
import { auth } from '../lib/auth';
import { personService } from '../lib/relationships/person-service';
import { userRelationshipService } from '../lib/relationships/user-relationship-service';
import { pool } from '../server';

const router = Router();

// Middleware to ensure user is authenticated
router.use(async (req: Request, res: Response, next) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Attach user to request
    (req as any).user = session.user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// Get all user relationships
router.get('/relationships', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const relationships = await userRelationshipService.getAllRelationships(userId);
    
    return res.json({ relationships });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// Get distinct relationship types for the user
router.get('/relationships/types', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get distinct relationship types from user_relationships table
    const result = await pool.query(
      `SELECT DISTINCT relationship_type 
       FROM user_relationships 
       WHERE user_id = $1 
       ORDER BY relationship_type`,
      [userId]
    );
    
    const types = result.rows.map(row => row.relationship_type);
    
    return res.json(types);
  } catch (error) {
    console.error('Error fetching relationship types:', error);
    return res.status(500).json({ error: 'Failed to fetch relationship types' });
  }
});

// Create a new relationship type
router.post('/relationships', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { relationshipType, displayName } = req.body;
    
    if (!relationshipType || !displayName) {
      return res.status(400).json({ error: 'Relationship type and display name are required' });
    }
    
    const relationship = await userRelationshipService.createRelationship(userId, relationshipType, displayName);
    
    return res.status(201).json({ relationship });
  } catch (error: any) {
    console.error('Error creating relationship:', error);
    if (error.code === 'DUPLICATE_RELATIONSHIP') {
      return res.status(409).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to create relationship' });
    }
  }
});

// Update a relationship type
router.put('/relationships/:type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { type } = req.params;
    const { displayName, isActive } = req.body;
    
    // First find the relationship by type
    const existingRel = await userRelationshipService.getRelationshipByType(userId, type);
    if (!existingRel) {
      throw { code: 'NOT_FOUND', message: 'Relationship not found' };
    }
    
    const relationship = await userRelationshipService.updateRelationship(existingRel.id, {
      display_name: displayName,
      is_active: isActive
    });
    
    return res.json({ relationship });
  } catch (error: any) {
    console.error('Error updating relationship:', error);
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to update relationship' });
    }
  }
});

// Delete a relationship type
router.delete('/relationships/:type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { type } = req.params;
    
    // First find the relationship by type
    const existingRel = await userRelationshipService.getRelationshipByType(userId, type);
    if (!existingRel) {
      throw { code: 'NOT_FOUND', message: 'Relationship not found' };
    }
    
    await userRelationshipService.deleteRelationship(existingRel.id);
    
    return res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting relationship:', error);
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    } else if (error.code === 'FORBIDDEN') {
      return res.status(403).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to delete relationship' });
    }
  }
});

// Get all people
router.get('/people', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const people = await personService.listPeopleForUser({
      userId,
      limit,
      offset
    });
    
    return res.json({ people });
  } catch (error) {
    console.error('Error fetching people:', error);
    return res.status(500).json({ error: 'Failed to fetch people' });
  }
});

// Get a specific person
router.get('/people/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    const person = await personService.getPersonById(id, userId);
    
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    return res.json({ person });
  } catch (error: any) {
    console.error('Error fetching person:', error);
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to fetch person' });
    }
  }
});

// Create a new person
router.post('/people', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, emailAddress, relationshipType, confidence } = req.body;
    
    if (!name || !emailAddress) {
      return res.status(400).json({ error: 'Name and email address are required' });
    }
    
    const person = await personService.createPerson({
      userId,
      name,
      emailAddress,
      relationshipType,
      confidence
    });
    
    return res.status(201).json({ person });
  } catch (error: any) {
    console.error('Error creating person:', error);
    if (error.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: error.message });
    } else if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to create person' });
    }
  }
});

// Add email to person
router.post('/people/:id/emails', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { emailAddress } = req.body;
    
    if (!emailAddress) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    const person = await personService.addEmailToPerson(id, emailAddress, userId);
    
    return res.json({ person });
  } catch (error: any) {
    console.error('Error adding email:', error);
    if (error.code === 'PERSON_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    } else if (error.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: error.message });
    } else if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to add email' });
    }
  }
});

// Assign relationship to person
router.post('/people/:id/relationships', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { relationshipType, isPrimary, confidence } = req.body;
    
    if (!relationshipType) {
      return res.status(400).json({ error: 'Relationship type is required' });
    }
    
    // First verify the person exists
    const person = await personService.getPersonById(id, userId);
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    // Verify the relationship type exists
    const relationship = await userRelationshipService.getRelationshipByType(userId, relationshipType);
    if (!relationship) {
      return res.status(400).json({ error: 'Invalid relationship type' });
    }
    
    // Manually update the person_relationships table
    const pool = personService.getPool();
    
    // First, unset any existing primary relationship if this is to be primary
    if (isPrimary) {
      await pool.query(
        `UPDATE person_relationships 
         SET is_primary = false 
         WHERE user_id = $1 AND person_id = $2`,
        [userId, id]
      );
    }
    
    // Insert or update the relationship
    await pool.query(
      `INSERT INTO person_relationships 
       (user_id, person_id, user_relationship_id, is_primary, user_set, confidence, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
       ON CONFLICT (user_id, person_id, user_relationship_id) DO UPDATE 
       SET is_primary = $4,
           user_set = true,
           confidence = $5,
           updated_at = NOW()`,
      [userId, id, relationship.id, isPrimary || false, confidence || 0.5]
    );
    
    // Return updated person
    const updatedPerson = await personService.getPersonById(id, userId);
    return res.json({ person: updatedPerson });
  } catch (error: any) {
    console.error('Error assigning relationship:', error);
    return res.status(500).json({ error: 'Failed to assign relationship' });
  }
});

// Merge two people
router.post('/people/merge', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { sourcePersonId, targetPersonId } = req.body;
    
    if (!sourcePersonId || !targetPersonId) {
      return res.status(400).json({ error: 'Source and target person IDs are required' });
    }
    
    const mergedPerson = await personService.mergePeople({
      userId,
      sourcePersonId,
      targetPersonId
    });
    
    return res.json({ person: mergedPerson });
  } catch (error: any) {
    console.error('Error merging people:', error);
    if (error.code === 'PERSON_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    } else if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to merge people' });
    }
  }
});

// Get relationship suggestions for an email
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    const suggestions = await userRelationshipService.getRelationshipSuggestions();
    
    return res.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

export default router;