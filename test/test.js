var assert = require('assert');
var should = require('should');

var host = process.env.TEST_DOCUMENTDB_HOST_URL;
var masterKey = process.env.TEST_DOCUMENTDB_MASTER_KEY;
var collectionUrl = process.env.TEST_DOCUMENTDB_COLLECTION_URL;


//test data
var UserSchema = require('../lib/schema');


// Test Data
var tenantUserId = '';		// will be populated later in the tests
var tenantlessUserId = '';  // will be populated later in the tests

var testTenant = '#TEST_TENANT#';
var testUser1UserHandle = '|||TESTUSER1|||';
var testUser1TwitterID = '###TESTUSER1_TWITTER!###';

var testUser2UserHandle = '|||TESTUSER2|||';
var testUser2TwitterID = '###TESTUSER2_TWITTER!###';



var passwordTenantUser = new UserSchema();
var passwordTenantUserId = '';
var passwordTenantUserPassword = '###PASSWORD1###'; 
passwordTenantUser.userHandle = '||||TESTUSER3|||';
passwordTenantUser.tenant = testTenant;
//passwordTenantUser.addLocalStrategy(passwordTenantUser.userHandle, passwordTenantUserPassword, function(err, results){
//	console.log('------');
//	console.log(err);
//	console.log(results);
//	console.log('------');
//});

//end of test data



describe('Local Strategy Tests', function() {
	this.timeout(5000);

	before(function(){

	});
	describe('Save Password Tenant User', function () {
		it('should save successfully', function (done) {

			passwordTenantUser.addLocalStrategy(passwordTenantUser.userHandle, passwordTenantUserPassword, function(err, results){
				if (err) throw err;

				passwordTenantUser.save(function(err, results){
					if (err) throw err;
					passwordTenantUserId = passwordTenantUser.id;
					done();
				});
			});


		});
	});

	describe('Add local strategy to user that already has a local strategy', function () {
		it('should fail to add duplicate strategy', function (done) {
			var user = new UserSchema();
			user.loginViaPassword(passwordTenantUser.userHandle, passwordTenantUserPassword, passwordTenantUser.tenant, function(err, results){
				if (err) throw err;
				user.id.should.not.equal('');
				user.addLocalStrategy('TESTUSER', 'PASSWORD', function(err, results){
					err.message.should.equal('A user cannot have two strategies of the same type');
				});
				done();
			});
		});
	});
	describe('Password Login Tenant User', function () {
		it('should login successfully', function (done) {
			var testUser = new UserSchema();
			testUser.loginViaPassword(passwordTenantUser.userHandle, passwordTenantUserPassword, passwordTenantUser.tenant, function(err, results){
				if (err) throw err;
				testUser.userHandle.should.equal(passwordTenantUser.userHandle);
				testUser.id.should.not.equal('');
				results.should.equal(true);
				done();
			});
		});
	});
	describe('Failed Password Login Tenant User', function () {
		it('should not login', function (done) {
			var testUser = new UserSchema();
			testUser.loginViaPassword(passwordTenantUser.userHandle, passwordTenantUserPassword + 'XXX', passwordTenantUser.tenant, function(err, results){
				if (err) throw err;
				results.should.equal(false);
				testUser.id.should.equal('');
				testUser.userHandle.should.equal('');
				done();
			});
		});
	});

	describe('Failed Login, Valid Password, Invalid  Login Tenant User', function () {
		it('should not login', function (done) {
			var testUser = new UserSchema();
			testUser.loginViaPassword(passwordTenantUser.userHandle, passwordTenantUserPassword, '', function(err, results){
				if (err) throw err;
				results.should.equal(false);
				testUser.id.should.equal('');
				testUser.userHandle.should.equal('');
				done();
			});
		});
	});
});

describe('Pocket Strategy Tests', function() {
	this.timeout(5000);
	before(function(){

	});
	describe('Create user without tenant with Pocket strategy', function () {
		it('should create user', function (done) {
			var usr = new UserSchema();

			usr.userHandle = '|||POCKET_TESTUSER1|||';
			usr.addPocketStrategy(usr.userHandle, 'TEST_TOKEN', function(err, results){
				if (err) throw err;
				usr.save(function(err, data){
					if (err) throw err;
					usr.id.should.not.equal('');
					done();
				});
			});
		});
	});

	describe('Login user without tenant with Pocket strategy', function () {
		it('should find user and update token', function (done) {
			var usr = new UserSchema();
			var newToken = 'TEST_TOKEN2';
			usr.loginViaPocket('|||POCKET_TESTUSER1|||', newToken, '', function(err, results){
				if (err) throw err;
				usr.id.should.not.equal('');
				usr.userHandle.should.equal('|||POCKET_TESTUSER1|||');
				var foundPocketStrategy = false;
				for (var x=0;x<usr.strategies.length;x++){
					if (usr.strategies[x].type === 'POCKET'){
						usr.strategies[x].token.should.equal(newToken);
						foundPocketStrategy = true;
					}
				}
				foundPocketStrategy.should.equal(true);
				done();
			});
		});
	});

	describe('Remove pocket user without tenant', function () {
		it('should remove matching user', function (done) {
			var usr = new UserSchema();
			usr.loginViaPocket('|||POCKET_TESTUSER1|||', 'TEST_TOKEN2', '', function(err, results){
				if (err) throw err;
				usr.id.should.not.equal('');
				usr.userHandle.should.equal('|||POCKET_TESTUSER1|||');

				usr.remove(function(err2, results2){
					if (err2) throw err2;
					usr.loginViaPocket('|||POCKET_TESTUSER1|||', 'TEST_TOKEN2', '', function(err3, results3){
						if (err3) throw err3;
						usr.id.should.equal('');
					});
				});
				done();
			});
		});
	});

});




describe('Cross Strategy Tests', function() {
	this.timeout(5000);
	before(function(){

	});

	describe('Create user with multiple strategies', function(){
		it('should not allow the creation of the second strategy', function(done){
			var user = new UserSchema();
			user.addPocketStrategy('TESTUSER', 'TESTHANDLE', function(err, results){
				if (err) throw err;
				user.addLocalStrategy('TESTUSER', 'PASSWORD', function(err2, results2){
					err2.message.should.equal('An unpersisted user cannot have more than one strategy');
					done();
				});			
			});
		});
	});



	describe('Save With Tenant', function () {
		it('should persist without error', function (done) {
			var tenantUser = new UserSchema();
			tenantUser.userHandle = testUser1UserHandle;
			tenantUser.tenant = testTenant;
			tenantUser.addTwitterStrategy(testUser1TwitterID, 'TWITTER_TOKEN', function(err, results){
				if (err) throw err;
				tenantUser.save(function(err, results){
					if (err) throw err;
					tenantUserId = tenantUser.id;
					done();
				});
			});
		});
	});


	describe('Save Without Tenant', function () {
		it('should persist without error', function (done) {
			var tenantlessUser = new UserSchema();
			tenantlessUser.userHandle = testUser2UserHandle;
			tenantlessUser.addTwitterStrategy(testUser2TwitterID, 'TWITTER_TOKEN', function(err, results){
				if (err) throw err;
				tenantlessUser.save(function(err, results){
					if (err) throw err;
					tenantlessUserId = tenantlessUser.id;
					done();
				});
			});
		});
	});

	describe('Get By Strategy With Tenant', function () {
		it('should retrieve matching user', function (done) {
			var testUser = new UserSchema();	
			testUser.getByStrategy('TWITTER', testUser1TwitterID, testTenant, function(err, user){
				if (err) throw err;
				testUser.sid.should.equal(testUser1TwitterID);
				done();
			});
		});
	});

	describe('Get By Strategy Without Tenant', function () {
		it('should retrieve matching user', function (done) {
			var testUser = new UserSchema();	
			testUser.getByStrategy('TWITTER', testUser2TwitterID, '', function(err, result){
				if (err) throw err;
				testUser.sid.should.equal(testUser2TwitterID);
				done();
			});
		});
	});

	describe('Get By Strategy With Tenant with Invalid Strategy Id', function () {
		it('should retrieve matching user', function (done) {
			var testUser = new UserSchema();			
			testUser.getByStrategy('TWITTER', 'INVALID_USER_STRATEGY_ID', testTenant, function(err, user){
				if (err) throw err;
				testUser.id.should.equal('');
				done();
			});
		});
	});

	describe('Get By Strategy Without Tenant with Invalid Strategy Id', function () {
		it('should retrieve matching user', function (done) {
			var testUser = new UserSchema();			
			testUser.getByStrategy('TWITTER', 'INVALID_USER_STRATEGY_ID', '', function(err, user){
				if (err) throw err;
				testUser.id.should.equal('');
				done();
			});
		});
	});

	describe('Get By Strategy With Invalid Tenant', function () {
		it('should retrieve undefined value', function (done) {
			var testUser = new UserSchema();			
			testUser.getByStrategy('TWITTER', testUser1TwitterID, 'INVALID_TENANT', function(err, user){
				if (err) throw err;
				testUser.id.should.equal('');
				done();	
			});
		});
	});


	describe('Update User with Tenant', function () {
		it('should update successfully', function (done) {
			var testUser = new UserSchema();
			testUser.getById(tenantUserId, function(err, results){
				if (err) throw err;
				testUser.id.should.not.equal('');
				testUser.id.should.equal(tenantUserId);

				var newEmail = testUser.email + '1234';
				testUser.email = newEmail;

				testUser.save(function(err2, results2){
					if (err2) throw err2;
					var testUser2 = new UserSchema();
					testUser2.getById(tenantUserId, function(err3, results3){
						if (err3) throw err3;
						testUser2.email.should.equal(newEmail);
						done();
					});
				});
			});
		});
	});


	describe('Update User without Tenant', function () {
		it('should update successfully', function (done) {
			var testUser = new UserSchema();			
			testUser.getById(tenantlessUserId, function(err, results){
				if (err) throw err;
				var newEmail = testUser.email + '1234';
				testUser.email = newEmail;
				testUser.save(function(err2, data){
					if (err2) throw err2;
					var testUser2 = new UserSchema();
					testUser2.getById(tenantlessUserId, function(err3, results){
						if (err3) throw err3;
						testUser2.email.should.equal(newEmail);
						done();
					});
				});
			});
		});
	});

	describe('Create duplicate user with tenant', function () {
		it('should fail to create duplicate user', function (done) {
			var tenantUser = new UserSchema();
			tenantUser.userHandle = testUser1UserHandle;
			tenantUser.tenant = testTenant;
			tenantUser.addTwitterStrategy(testUser1TwitterID + 'abcd', 'TWITTER_TOKEN', function(err, results){
				if (err) throw err;
				tenantUser.save(function(errSave, data){
					errSave.message.should.equal('User exists already with this user handle');
					done();
				});
			});
		});
	});

	describe('Create duplicate user without tenant', function () {
		it('should fail to create duplicate user', function (done) {
			var tenantlessUser = new UserSchema();
			var tenantlessUserId = testUser2UserHandle;

			tenantlessUser.userHandle = testUser2UserHandle;
			tenantlessUser.addTwitterStrategy(testUser2TwitterID + 'abcd', 'TWITTER_TOKEN', function(err, results){
				if (err) throw err;
				tenantlessUser.save(function(errSave, data){
					errSave.message.should.equal('User exists already with this user handle');
					done();
				});
			});
		});
	});


	describe('Create user with tenant with duplicated strategy', function () {
		it('should fail to create user', function (done) {
			var usr = new UserSchema();
			usr.userHandle = '|||TESTUSER3|||';
			usr.tenant = testTenant;
			usr.addTwitterStrategy(testUser1TwitterID, 'TWITTER_TOKEN', function(err, results){
				err.message.should.equal('This strategy is already in use');
				done();
			});
		});
	});

	describe('Create user without tenant with duplicated strategy', function () {
		it('should fail to create user', function (done) {
			var usr = new UserSchema();
			usr.userHandle = '|||TESTUSER3|||';
			usr.addTwitterStrategy(testUser2TwitterID, 'TWITTER_TOKEN', function(err, results){
				err.message.should.equal('This strategy is already in use');
				done();
			});
		});
	});







	describe('Remove user with tenant', function () {
		it('should remove matching user', function (done) {
			var testUser = new UserSchema();
			testUser.getById(tenantUserId, function(err, results){
				if (err) throw err;
				testUser.remove(function(err2, data){
					if (err2) throw err2;
					testUser.getById(tenantUserId, function(err, results){
						if (err) throw err;
						testUser.id.should.equal('');
						done();
					});
				});
			});
		});
	});

	describe('Remove user without tenant', function () {
		it('should remove matching user', function (done) {
			var testUser = new UserSchema();
			testUser.getById(tenantlessUserId, function(err, results){
				if (err) throw err;
				testUser.remove(function(err2, data){
					if (err2) throw err2;
					testUser.getById(tenantlessUserId, function(err, results){
						if (err) throw err;
						testUser.id.should.equal('');
						done();
					});
				});
			});
		});
	});

	describe('Remove password tenant user', function () {
		it('should remove matching user', function (done) {
			var testUser = new UserSchema();			
			testUser.getById(passwordTenantUserId, function(err, results){
				if (err) throw err;
				testUser.remove(function(err2, data){
					if (err2) throw err2;
					testUser.getById(passwordTenantUserId, function(err, results){
						if (err) throw err;
						testUser.id.should.equal('');
						done();
					});
				});
			});
		});
	});

	describe('Create user with invalid schema (no docType)', function(){
		it('should not save successfully', function(done){
			var tenantlessUser = new UserSchema();
			tenantlessUser.userHandle = testUser2UserHandle;
			tenantlessUser.addTwitterStrategy(testUser2TwitterID, 'TWITTER_TOKEN', function(err, results){
				if (err) throw err;
				tenantlessUser.docType = undefined;
				tenantlessUser.save(function(err, data){
					err.message.should.equal('docType property has been removed, it is required');
					done();
				});
			});
		});
	});


	after(function(){
	});

});
