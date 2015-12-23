/*jslint node: true */
"use strict";

//var DocumentDBUserAuthenticationPersistence = function(host, masterKey, collectionUrl){
module.exports = function(host, masterKey, collectionUrl){

	var bcryptjs = require('bcryptjs');

	var DocumentDBClient = require('documentdb').DocumentClient;
	var _client = new DocumentDBClient(host, {masterKey: masterKey}); 	
	var _collectionUrl = collectionUrl;

	/*
	function create(user, cb){
		validateSchema(user, function(err, validation){
			if (err) return cb(err, null);

			if (user.strategies.length > 1){
				return cb(new Error('New users can only have one strategy'), null);
			}

			findByUserHandle(user.userHandle, user.tenant, function(err, data){
				if (err) return cb(err, null);
				if (data === undefined){
					getByStrategy(user.strategies[0].type, user.strategies[0].id, user.tenant, function(errStrategySearch, strategyMatch){
						if (errStrategySearch) return cb(errStrategySearch, null);
						if (strategyMatch === undefined){
							_client.createDocument(_collectionUrl, user, cb);
						}
						else{
							return cb(new Error('This strategy is already in use'), null);
						}
					});
				}
				else{
					return cb(new Error('User exists already with this user handle'), null);
				}
			});
		});
	}
	*/

	function evernoteLogin(userHandle, accessToken, tenant, cb){
		strategyLogin(userHandle, 'EVERNOTE', accessToken, tenant, cb);
	}	

	/*
	function findByUserHandle(userHandle, tenant, cb){
		var querySpec = {
			query: 'SELECT * FROM u WHERE u.userHandle = @userHandle AND u.tenant = @tenant AND u.docType = "USER"',
			parameters: [
				{name: '@userHandle', value: userHandle},
				{name: '@tenant', value: tenant}
			]
		};

		_client.queryDocuments(_collectionUrl, querySpec).toArray(function(err, results){
			if (err) return cb(err, null);
			return cb(null, results[0]);
		});
	}
	*/

	function findOrCreate(user, cb){
		validateSchema(user, function(err, validation){
			if (err) return cb(err, null);

			getByStrategy(user.strategies[0].strategyKey, user.strategies[0].id, function(err, retrievedUser){
				if (err) return cb(err, null);
				if (retrievedUser !== null){
					return cb(null, retrievedUser);
				}
				else{
					create(user, cb);
				}
			});
		});
	}

	
	function get(id, cb){
		var querySpec = {
			query: 'SELECT * FROM u WHERE u.id = @id AND u.docType = "USER"',
			parameters: [{name: '@id', value: id}]
		};

		_client.queryDocuments(_collectionUrl, querySpec).toArray(function(err, results){
			if (err) return cb(err, null);
			return cb(null, results[0]);
		});
	}

	/*
	function getByStrategy(strategyType, strategyId, tenant, cb){
		var querySpec = {
			query: 'SELECT u.id, u.displayName, s.type, s.id sid, s.token FROM u JOIN s IN u.strategies WHERE s.type = @strategyType AND s.id = @strategyId AND u.tenant = @tenant AND u.docType = "USER"',
			parameters: [
				{name: '@strategyType', value: strategyType},
				{name: '@strategyId', value: strategyId},
				{name: '@tenant', value: tenant}
			]
		};

		_client.queryDocuments(_collectionUrl, querySpec).toArray(function(err, results){
			if (err) return cb(err, null);
			return cb(null, results[0]);			
		});
	}
	*/

	function linkStrategy(userId, tenant, cb){

	}
	
	/*	
	function passwordLogin(userHandle, password, tenant, cb){
		var querySpec = {
			query: 'SELECT u.id, u.displayName, s.type, s.id sid, s.token, s.hash FROM u JOIN s IN u.strategies WHERE s.type = "LOCAL" AND s.id = @userHandle AND u.tenant = @tenant AND u.docType = "USER"',
			parameters: [
				{name: '@userHandle', value: userHandle},
				{name: '@tenant', value: tenant}
			]
		};

		_client.queryDocuments(_collectionUrl, querySpec).toArray(function(err, results){
			if (err) return cb(err, null);
			if (results[0] !== undefined){
				if (bcryptjs.compareSync(password, results[0].hash)){
					get(results[0].id, cb);
				}
				else{
					return cb(null, undefined);			
				}
			}
			else{
				return cb(null, undefined);			
			}
		});

	}
	*/
	function pocketLogin(userHandle, accessToken, tenant, cb){
		strategyLogin(userHandle, 'POCKET', accessToken, tenant, cb);
	}

	function strategyLogin(userHandle, strategyType, accessToken, tenant, cb){
		var querySpec = {
			query: 'SELECT u.id, u.displayName, s.type, s.id sid, s.token FROM u JOIN s IN u.strategies WHERE s.type = @strategyType AND s.id = @userHandle AND u.tenant = @tenant AND u.docType = "USER"',
			parameters: [
				{name: '@userHandle', value: userHandle},
				{name: '@tenant', value: tenant},
				{name: '@strategyType', value: strategyType}
			]
		};

		_client.queryDocuments(_collectionUrl, querySpec).toArray(function(err, results){
			if (err) return cb(err, null);
			if (results[0] !== undefined){
				if (results[0].token !== accessToken){
					// need to update token
					
					get(results[0].id, function(err2, fullUser){
						if (err2) return cb(err2, null);
						for (var x=0;x<fullUser.strategies.length;x++){
							if (fullUser.strategies[x].type === strategyType){
								fullUser.strategies[x].token = accessToken;
							}
						}
						_client.replaceDocument(fullUser._self, fullUser, cb);
					});
				}
				else{
					get(results[0].id, cb);
				}
			}
			else{
				return cb(null, undefined);			
			}
		});		
	}
	/*
	function remove(documentLink, cb){
		_client.deleteDocument(documentLink, cb);
	}
	*/
	/*
	function update(user, cb){
		_client.replaceDocument(user._self, user, cb);
	}
	*/

	/*
	function validateSchema(user, cb){
		if (user.docType === undefined) return cb(new Error('docType property has been removed, it is required'), null);
		if (user.userHandle === undefined) return cb(new Error('userHandle property has been removed, it is required'), null);
		if (user.userHandle === '') return cb(new Error('userHandle must have a value'), null);

		if (user.strategies === undefined) return cb(new Error('strategies collection has been removed, it is required'), null);
		if (user.strategies.length === 0) return cb(new Error('At least one strategy is required'), null);

		if (user.tenant === undefined) return cb(new Error('tenant property has been removed, it is required'), null);
		return cb(null, true);
	}
	*/

	return {
		//create: create,
		evernoteLogin: evernoteLogin,
		//findByUserHandle: findByUserHandle,
		findOrCreate: findOrCreate,
		//get: get,
		//getByStrategy: getByStrategy,
		//passwordLogin: passwordLogin,
		pocketLogin: pocketLogin
		//remove: remove//,
		//update: update
	};
};
