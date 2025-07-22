#!/usr/bin/env node
import { personService } from '../lib/relationships/person-service';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb',
});

async function demoPersonService() {
  console.log('🚀 PersonService Demo\n');
  
  try {
    // Initialize the service
    await personService.initialize();
    console.log('✅ PersonService initialized\n');
    
    // Create a test user for the demo
    const testUserId = 'demo-user-' + Date.now();
    const testEmail = `demo-${Date.now()}@example.com`;
    await pool.query(
      `INSERT INTO "user" (id, email, name, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [testUserId, testEmail, 'Demo User']
    );
    
    // Create default relationships for the test user
    const relationships = ['friend', 'colleague', 'professional', 'external'];
    for (const rel of relationships) {
      await pool.query(
        `INSERT INTO user_relationships (user_id, relationship_type, display_name, is_active, is_system_default)
         VALUES ($1, $2, $3, true, true)`,
        [testUserId, rel, rel.charAt(0).toUpperCase() + rel.slice(1)]
      );
    }
    
    console.log('📝 Demo 1: Create a person with email and relationship');
    const person1 = await personService.createPerson({
      userId: testUserId,
      name: 'John Doe',
      emailAddress: 'john.doe@example.com',
      relationshipType: 'colleague',
      confidence: 0.9
    });
    console.log('Created person:', {
      id: person1.id,
      name: person1.name,
      emails: person1.emails.map(e => e.email_address),
      relationships: person1.relationships.map(r => r.relationship_type)
    });
    
    console.log('\n📝 Demo 2: Add another email to the person');
    const updatedPerson = await personService.addEmailToPerson(
      person1.id,
      'jdoe@company.com',
      testUserId
    );
    console.log('Added email. Person now has emails:', 
      updatedPerson.emails.map(e => e.email_address)
    );
    
    console.log('\n📝 Demo 3: Find person by email (case insensitive)');
    const foundPerson = await personService.findPersonByEmail(
      'JOHN.DOE@EXAMPLE.COM',
      testUserId
    );
    console.log('Found person:', foundPerson ? foundPerson.name : 'Not found');
    
    console.log('\n📝 Demo 4: Create another person for merge demo');
    const person2 = await personService.createPerson({
      userId: testUserId,
      name: 'Johnny Doe',
      emailAddress: 'johnny@personal.com',
      relationshipType: 'friend',
      confidence: 0.8
    });
    console.log('Created duplicate person:', {
      id: person2.id,
      name: person2.name,
      emails: person2.emails.map(e => e.email_address)
    });
    
    console.log('\n📝 Demo 5: List all people before merge');
    const peopleBeforeMerge = await personService.listPeopleForUser({
      userId: testUserId,
      limit: 10
    });
    console.log('Total people:', peopleBeforeMerge.length);
    peopleBeforeMerge.forEach(p => {
      console.log(`  - ${p.name}: ${p.emails.length} email(s), ${p.relationships.length} relationship(s)`);
    });
    
    console.log('\n📝 Demo 6: Merge duplicate people');
    const mergedPerson = await personService.mergePeople({
      userId: testUserId,
      sourcePersonId: person2.id,
      targetPersonId: person1.id
    });
    console.log('Merged person now has:');
    console.log('  - Emails:', mergedPerson.emails.map(e => e.email_address));
    console.log('  - Relationships:', mergedPerson.relationships.map(r => 
      `${r.relationship_type} (confidence: ${r.confidence}, primary: ${r.is_primary})`
    ));
    
    console.log('\n📝 Demo 7: List all people after merge');
    const peopleAfterMerge = await personService.listPeopleForUser({
      userId: testUserId,
      limit: 10
    });
    console.log('Total people:', peopleAfterMerge.length);
    
    // Cleanup
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [testUserId]);
    console.log('\n✅ Demo completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

demoPersonService();