/*jslint node: true */
"use strict";

var bcryptjs = require('bcryptjs');
var uuid = require('uuid');

var AWS = require("aws-sdk");

AWS.config.update({region: "us-west-1", endpoint: "https://dynamodb.us-west-1.amazonaws.com"});

var dynamodb = new AWS.DynamoDB.DocumentClient();
var internalDelimiter = '#:#';


//var DocumentDBClient = require('documentdb').DocumentClient;

//TODO COME BACK AND RESOLVE
//var host = process.env.TEST_DOCUMENTDB_HOST_URL;
//var masterKey = process.env.TEST_DOCUMENTDB_MASTER_KEY;
//var _collectionUrl = process.env.TEST_DOCUMENTDB_COLLECTION_URL;
//var _client = new DocumentDBClient(host, {masterKey: masterKey}); 	

var User = function(){

	this.id = '';
	//this.docType = 'USER';
	this.userHandle = '';
	this.email = '';
	this.tenant = '';
	this.strategies = [];
	var self = this;


	function init(){
		self.id = '';
		//self.docType = 'USER';
		self.userHandleTenant = '';
		self.email = '';
		self.tenant = '';
		self.strategies = [];		
	}

	//privileged methods
	this._create = function(cb){
		_validateNewUser(function(err, validation){
			if (err) return cb(err, null);


			self.id = uuid.v4();
		    dynamodb.put({TableName: 'users', Item: self}, function(err2, data) {
		    	if (err2) return cb(err2, null);
		    	// save strategies off to to strategy table until DynamoDB can support queries against
		    	// internal json structure
		    	var strategy = {};
		    	strategy.key = _createStrategyKey(self.tenant, self.strategies[0].id, self.strategies[0].type);
		    	strategy.id = self.strategies[0].id;
		    	strategy.type = self.strategies[0].type;
		    	strategy.userId = self.id;
		    	strategy.tenant = self.tenant;
		    	strategy.token = self.strategies[0].token;
		    	dynamodb.put({TableName: 'strategies', Item: strategy}, function(err3, data3){
		    		if (err3) return cb(err3, null);
			    	return cb(null, true);
		    	});
		    });
		});
	};

	this._getById = function(id, cb){
		var params = {
		    TableName : "users",
		    KeyConditionExpression: "#id = :id",
		    ExpressionAttributeNames:{
		        "#id": "id"
		    },
		    ExpressionAttributeValues: {
		        ":id": id
		    }
		};

		dynamodb.query(params, function(err, data) {
		    if (err) return cb(err, null);
			if (data.Items[0] !== undefined){
				for (var s in data.Items[0]){
					self[s] = data.Items[0][s];
				}
				return cb(null, true);			
			}
			else{
				init();
				return cb(null, false);
			}
		});
	};

	this._getByStrategy = function(strategyType, strategyId, tenant, cb){
		_getByStrategyPrivate(strategyType, strategyId, tenant, function(err, userData){
			if (err) return cb(err, null);
			if (userData !== undefined){
				for (var s in userData){
					self[s] = userData[s];
				}				
			}
			return cb(null, true);			
		});
	};

	this._remove = function(cb){
		var params = {
		    TableName : "strategies",
		    IndexName: 'userId-index',
		    KeyConditionExpression: "#userId = :userId",
		    ExpressionAttributeNames:{
		        "#userId": "userId"
		    },
		    ExpressionAttributeValues: {
		        ":userId": self.id
		    }
		};

		dynamodb.query(params, function(err, data) {
			if (err) return cb(err, null);
			_deleteStrategy(data.Items, 0, function(err2, data2){
				if (err2) return cb(err2, null);
				var params = {
				    TableName:'users',
				    Key:{
				        'id':self.id
				    }
				};
				console.log('right before');
				dynamodb.delete(params, cb);
			});
		});
		/*
		_client.deleteDocument(self._self, function(err, data){
			if (err) return cb(err);
			init();
			return cb(null, true);
		});
		*/
	};

	this._passwordLogin = function(userHandle, password, tenant, cb){
		_getByStrategyPrivate('LOCAL', userHandle, tenant, function(err, results){
			if (err) return cb(err, null);
			if (results === false) return cb(null, false);
			if (bcryptjs.compareSync(password, results.token)){
				self._getById(results.userId, cb);
			}
			else{
				return cb(null, false);			
			}
		});	



		/*
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
					self._getById(results[0].id, cb);
				}
				else{
					return cb(null, false);			
				}
			}
			else{
				return cb(null, false);			
			}
		});
		*/
	};

	this._strategyLogin = function(userHandle, strategyType, accessToken, tenant, cb){
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
					
					self._getById(results[0].id, function(err2, results){
						if (err2) return cb(err2, null);
						for (var x=0;x<self.strategies.length;x++){
							if (self.strategies[x].type === strategyType){
								self.strategies[x].token = accessToken;
							}
						}
						self._update(cb);
					});
				}
				else{
					self._getById(results[0].id, cb);
				}
			}
			else{
				return cb(null, false);			
			}
		});		
	};

	this._update = function(cb){
		//made business rule that you cannot update tenant or id
		var updateExpression = 'set userHandle = :userHandle';
		var expressionAttributeValues = {};
		expressionAttributeValues[':userHandle'] = self.userHandle;

		if (self.email !== undefined){
			updateExpression += ', email = :email';
			expressionAttributeValues[':email'] = self.email;			
		}
		else{
			throw "NEED TO IMPLEMENT";
		}

		var params = {
		    TableName:'users',
		    Key:{
		        "id": self.id
		    },
		    UpdateExpression: updateExpression,
		    ExpressionAttributeValues: expressionAttributeValues,
		    ReturnValues:"UPDATED_NEW"
		};
		dynamodb.update(params, cb);
		//_client.replaceDocument(self._self, self, cb);
	};

	this._validateAddingNewStrategy = function(strategyType, userHandle, cb){
		if (this.strategies.length > 0 && this.id === '') return cb(new Error('An unpersisted user cannot have more than one strategy'), null);
		for (var x=0;x<this.strategies.length;x++){
			if (this.strategies[x].type === strategyType){
				return cb(new Error('A user cannot have two strategies of the same type'), null);
			}
		}
		_isStrategyInUse(strategyType, userHandle, self.tenant, function(err, results){
			if (err) return cb(err, null);
			return cb(null, true);
		});
	};

	//private methods
	function _createStrategyKey(tenant, strategyId, strategyType){
		var key = '';
		if (tenant !== undefined && tenant !== '') key += tenant + internalDelimiter;
		key += strategyId + internalDelimiter + strategyType;
		return key;
	}

	function _deleteStrategy(strategies, position, cb){
		var params = {
		    TableName:'strategies',
		    Key:{
		        'key':strategies[position].key
		    }
		};
		dynamodb.delete(params, function(err, data) {
		    if (err) return cb(err, null);
			if (position + 1 >= strategies.length){
				return cb(null, true);
			}
			else{
				_deleteStrategy(strategies, position+1, cb);
			}
		});
	}

	function _findByUserHandle(userHandle, tenant, cb){
		var params = {
		    TableName : "users",
		    IndexName: 'userHandle-index',
		    KeyConditionExpression: "#userHandle = :userHandle",
		    ExpressionAttributeNames:{
		        "#userHandle": "userHandle"
		    },
		    ExpressionAttributeValues: {
		        ":userHandle": userHandle
		    }
		};

		dynamodb.query(params, function(err, data) {
			if (err) return cb(err, null);
			if (data.Items[0] === undefined){
				return cb(null, undefined);
			}
			var matchIndex = -1;
			for (var x=0;x<data.Items.length;x++){
				if (data.Items[x].tenant === tenant){
					matchIndex = x;
					break;
				}
			}
			if (matchIndex === -1){
				return cb(null, undefined);
			}
			else{
				return cb(null, data.Items[matchIndex]);
			}
		});

		/*
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
		*/
	}

	function _isStrategyInUse(strategyType, strategyID, tenant, cb){
		_getByStrategyPrivate(strategyType, strategyID, tenant, function(err, strategyMatch){
			if (err) return cb(err, null);
			if (strategyMatch === false){
				return cb(null, false);
			}
			else{
				return cb(new Error('This strategy is already in use'), null);
			}
		});
	}

	function _getByStrategyPrivate(strategyType, strategyId, tenant, cb){
		var params = {
		    TableName : "strategies",
		    KeyConditionExpression: "#key = :generatedKey",
		    ExpressionAttributeNames:{
		        "#key": "key"
		    },
		    ExpressionAttributeValues: {
		        ":generatedKey": _createStrategyKey(tenant, strategyId, strategyType)
		    }
		};

		dynamodb.query(params, function(err, data) {
		    if (err) {
		        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
		    } else {
		    	if (data.Items[0] !== undefined){
		    		return cb(null, data.Items[0]);
		    	}
		    	else{
		    		return cb(null, false);
		    	}
		    }
		});
	}

	function _validateSchema(cb){
		//if (self.docType === undefined) return cb(new Error('docType property has been removed, it is required'), null);
		if (self.userHandle === undefined) return cb(new Error('userHandle property has been removed, it is required'), null);
		if (self.userHandle === '') return cb(new Error('userHandle must have a value'), null);

		if (self.strategies === undefined) return cb(new Error('strategies collection has been removed, it is required'), null);
//TODO COME BACK AND ADD THIS ON
		//if (self.strategies.length === 0) return cb(new Error('At least one strategy is required'), null);

		//if (self.tenant === undefined) return cb(new Error('tenant property has been removed, it is required'), null);
		return cb(null, true);
	}

	function _validateNewUser(cb){
		_validateSchema(function(err, validation){
			if (err) return cb(err, null);

			if (self.strategies.length > 1){
				return cb(new Error('New users can only have one strategy'), null);
			}
			_findByUserHandle(self.userHandle, self.tenant, function(err, results){
				if (err) return cb(err, null);
				if (results === undefined){
					_isStrategyInUse(self.strategies[0].type, self.strategies[0].id, self.tenant, function(errStrategyInUse, strategyMatch){
						if (errStrategyInUse) return cb(errStrategyInUse, null);
						return cb(null, true);
					});
				}
				else{
					return cb(new Error('User exists already with this user handle'), null);
				}
			});
		});		
	}
};


//public methods

//User.prototype.addStrategy = function(strategyId, strategyType, strategyToken){
//	this.strategies.push({id: strategyId, type: strategyType, token: strategyToken});
//};

User.prototype.addLocalStrategy = function(userName, password, cb){
	var _this = this;
	this._validateAddingNewStrategy('LOCAL', userName, function(err, results){
		if (err) return cb(err, null);
		var salt = bcryptjs.genSaltSync(10);
		var hash = bcryptjs.hashSync(password, salt);
		_this.strategies.push({id: userName, type: 'LOCAL', token: hash});
		return cb(null, true);
	});
};

User.prototype.addEvernoteStrategy = function(userHandle, accessToken, cb){
	var _this = this;
	this._validateAddingNewStrategy('EVERNOTE', userHandle, function(err, results){
		if (err) return cb(err, null);
		_this.strategies.push({id: userHandle, type: 'EVERNOTE', token: accessToken});
		return cb(null, true);
	});
};

User.prototype.addPocketStrategy = function(userHandle, accessToken, cb){
	var _this = this;
	this._validateAddingNewStrategy('POCKET', userHandle, function(err, results){
		if (err) return cb(err, null);
		_this.strategies.push({id: userHandle, type: 'POCKET', token: accessToken});
		return cb(null, true);
	});
};

User.prototype.addTwitterStrategy = function(userHandle, accessToken, cb){
	var _this = this;
	this._validateAddingNewStrategy('TWITTER', userHandle, function(err, results){
		if (err) return cb(err, null);
		_this.strategies.push({id: userHandle, type: 'TWITTER', token: accessToken});
		return cb(null, true);
	});
};

User.prototype.getById = function(id, cb){
	this._getById(id, cb);
};

User.prototype.getByStrategy = function(strategyType, strategyId, tenant, cb){
	this._getByStrategy(strategyType, strategyId, tenant, cb);
};

User.prototype.loginViaEvernote = function(userHandle, accessToken, tenant, cb){
	this._strategyLogin(userHandle, 'EVERNOTE', accessToken, tenant, cb);
};

User.prototype.loginViaPassword = function(userHandle, password, tenant, cb){
	this._passwordLogin(userHandle, password, tenant, cb);
};

User.prototype.loginViaPocket = function(userHandle, accessToken, tenant, cb){
	this._strategyLogin(userHandle, 'POCKET', accessToken, tenant, cb);
};

User.prototype.remove = function(cb){
	this._remove(cb);
};

User.prototype.save = function(cb){
	if (this.email === '') this.email = undefined;
	if (this.tenant === '') this.tenant = undefined;
	if (this.id === ''){
		this._create(cb);
	}
	else{
		this._update(cb);
	}
};

module.exports = User;