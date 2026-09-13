const { existsSync, writeJsonSync, readJSONSync } = require("fs-extra");
const moment = require("moment-timezone");
const path = require("path");
const _ = require("lodash");
const { CustomError, TaskQueue, getType } = global.utils;

const optionsWriteJSON = {
	spaces: 2,
	EOL: "\n"
};

const taskQueue = new TaskQueue(function (task, callback) {
	if (getType(task) === "AsyncFunction") {
		task()
			.then(result => callback(null, result))
			.catch(err => callback(err));
	}
	else {
		try {
			const result = task();
			callback(null, result);
		}
		catch (err) {
			callback(err);
		}
	}
});

// Tableau de suivi pour éviter les créations en double simultanées (Similaire à usersData/threadsData)
const creatingBankData = [];

module.exports = async function (databaseType, bankModel, fakeGraphql) {
	let Bank = [];
	const pathBankData = path.join(__dirname, "..", "data/bankData.json");

	switch (databaseType) {
		case "mongodb":
			Bank = (await bankModel.find({}).lean()).map(item => _.omit(item, ["_id", "__v"]));
			break;
		case "sqlite":
			Bank = (await bankModel.findAll()).map(item => item.get({ plain: true }));
			break;
		case "json":
			if (!existsSync(pathBankData))
				writeJsonSync(pathBankData, [], optionsWriteJSON);
			Bank = readJSONSync(pathBankData);
			break;
	}

	global.db.allBankData = Bank;

	const defaultBankData = (userID) => ({
		userID,
		balance: 0,
		savings: 0,
		vault: 0,
		loan: 0,
		loanDate: null,
		creditScore: 600,
		bankLevel: 1,
		premium: false,
		multiplier: 1,
		streak: 0,
		reputation: 0,
		lastInterest: Date.now(),
		transactions: [],
		achievements: [],
		stocks: {},
		crypto: {},
		realEstate: [],
		businesses: [],
		vehicles: [],
		skills: { gambling: 0, trading: 0, business: 0, investing: 0 }
	});

	async function save(userID, bankDataObj, mode, pathStr) {
		try {
			const index = _.findIndex(global.db.allBankData, { userID });
			if (index === -1 && mode === "update") {
				throw new CustomError({
					name: "BANK_NOT_FOUND",
					message: `Can't find bank data for userID: ${userID} in database`
				});
			}

			switch (mode) {
				case "create": {
					switch (databaseType) {
						case "mongodb":
						case "sqlite": {
							let dataCreated = await bankModel.create(bankDataObj);
							dataCreated = databaseType == "mongodb" ?
								_.omit(dataCreated._doc, ["_id", "__v"]) :
								dataCreated.get({ plain: true });
							global.db.allBankData.push(dataCreated);
							return _.cloneDeep(dataCreated);
						}
						case "json": {
							const timeCreation = moment.tz().format();
							bankDataObj.createdAt = timeCreation;
							bankDataObj.updatedAt = timeCreation;
							global.db.allBankData.push(bankDataObj);
							writeJsonSync(pathBankData, global.db.allBankData, optionsWriteJSON);
							return _.cloneDeep(bankDataObj);
						}
					}
					break;
				}
				case "update": {
					const oldBankData = global.db.allBankData[index];
					const dataWillChange = {};

					if (Array.isArray(pathStr) && Array.isArray(bankDataObj)) {
						pathStr.forEach((p, idx) => {
							const key = p.split(".")[0];
							dataWillChange[key] = oldBankData[key];
							_.set(dataWillChange, p, bankDataObj[idx]);
						});
					}
					else if (pathStr && typeof pathStr === "string" || Array.isArray(pathStr)) {
						const key = Array.isArray(pathStr) ? pathStr[0] : pathStr.split(".")[0];
						dataWillChange[key] = oldBankData[key];
						_.set(dataWillChange, pathStr, bankDataObj);
					}
					else {
						for (const key in bankDataObj)
							dataWillChange[key] = bankDataObj[key];
					}

					switch (databaseType) {
						case "mongodb": {
							let dataUpdated = await bankModel.findOneAndUpdate({ userID }, dataWillChange, { returnDocument: 'after' });
							dataUpdated = _.omit(dataUpdated._doc, ["_id", "__v"]);
							global.db.allBankData[index] = dataUpdated;
							return _.cloneDeep(dataUpdated);
						}
						case "sqlite": {
							const getData = await bankModel.findOne({ where: { userID } });
							const dataUpdated = (await getData.update(dataWillChange)).get({ plain: true });
							global.db.allBankData[index] = dataUpdated;
							return _.cloneDeep(dataUpdated);
						}
						case "json": {
							dataWillChange.updatedAt = moment.tz().format();
							global.db.allBankData[index] = {
								...oldBankData,
								...dataWillChange
							};
							writeJsonSync(pathBankData, global.db.allBankData, optionsWriteJSON);
							return _.cloneDeep(global.db.allBankData[index]);
						}
					}
					break;
				}
				case "remove": {
					if (index != -1) {
						global.db.allBankData.splice(index, 1);
						if (databaseType == "mongodb")
							await bankModel.deleteOne({ userID });
						else if (databaseType == "sqlite")
							await bankModel.destroy({ where: { userID } });
						else
							writeJsonSync(pathBankData, global.db.allBankData, optionsWriteJSON);
					}
					break;
				}
			}
			return null;
		}
		catch (err) {
			throw err;
		}
	}

	async function create(userID) {
		if (!userID || typeof userID != "string" && typeof userID != "number")
			throw new CustomError({
				name: "INVALID_USER_ID",
				message: `The userID must be a string or a number, not a ${typeof userID}`
			});

		const strUserID = String(userID);
		const findInCreatingData = creatingBankData.find(u => u.userID == strUserID);
		if (findInCreatingData)
			return findInCreatingData.promise;

		const queue = new Promise(async function (resolve, reject) {
			try {
				if (global.db.allBankData.some(u => u.userID == strUserID)) {
					const existing = global.db.allBankData.find(u => u.userID == strUserID);
					return resolve(_.cloneDeep(existing));
				}
				const newDefaultData = defaultBankData(strUserID);
				const bankDataResult = await save(strUserID, newDefaultData, "create");
				resolve(_.cloneDeep(bankDataResult));
			}
			catch (err) {
				reject(err);
			}
			creatingBankData.splice(creatingBankData.findIndex(u => u.userID == strUserID), 1);
		});

		creatingBankData.push({
			userID: strUserID,
			promise: queue
		});

		return queue;
	}

	function getAll(pathStr, defaultValue, query) {
		return new Promise((resolve, reject) => {
			taskQueue.push(async function () {
				try {
					let dataReturn = _.cloneDeep(global.db.allBankData);
					if (query) {
						if (typeof query !== "string")
							throw new CustomError({
								name: "INVALID_QUERY",
								message: `The third argument (query) must be a string, not a ${typeof query}`
							});
						dataReturn = dataReturn.map(uData => fakeGraphql(query, uData));
					}
					if (pathStr) {
						if (!["string", "object"].includes(typeof pathStr))
							throw new CustomError({
								name: "INVALID_PATH",
								message: `The first argument (path) must be a string or an array, not a ${typeof pathStr}`
							});
						if (typeof pathStr === "string")
							return resolve(_.cloneDeep(dataReturn.map(uData => _.get(uData, pathStr, defaultValue))));
						else
							return resolve(_.cloneDeep(dataReturn.map(uData => _.times(pathStr.length, i => _.get(uData, pathStr[i], defaultValue[i])))));
					}
					return resolve(_.cloneDeep(dataReturn));
				}
				catch (err) {
					reject(err);
				}
			});
		});
	}

	function get_(userID, pathStr, defaultValue, query) {
		return new Promise(async (resolve, reject) => {
			try {
				if (!userID || (typeof userID != "string" && typeof userID != "number"))
					throw new CustomError({
						name: "INVALID_USER_ID",
						message: `The first argument (userID) must be a string or number, not a ${typeof userID}`
					});

				const strUserID = String(userID);
				let bankData = global.db.allBankData.find(u => u.userID == strUserID);
				
				// Auto-création si le compte n'existe pas encore (exactement comme usersData)
				if (!bankData) {
					bankData = await create(strUserID);
				}

				if (query) {
					if (typeof query !== "string")
						throw new CustomError({
							name: "INVALID_QUERY",
							message: `The fourth argument (query) must be a string, not a ${typeof query}`
						});
					bankData = fakeGraphql(query, bankData);
				}

				if (pathStr) {
					if (!["string", "object"].includes(typeof pathStr))
						throw new CustomError({
							name: "INVALID_PATH",
							message: `The second argument (path) must be a string or an array, not a ${typeof pathStr}`
						});
					if (typeof pathStr === "string")
						return resolve(_.cloneDeep(_.get(bankData, pathStr, defaultValue)));
					else
						return resolve(_.cloneDeep(_.times(pathStr.length, i => _.get(bankData, pathStr[i], defaultValue[i]))));
				}
				return resolve(_.cloneDeep(bankData));
			}
			catch (err) {
				reject(err);
			}
		});
	}

	function get(userID, pathStr, defaultValue, query) {
		return new Promise((resolve, reject) => {
			taskQueue.push(function () {
				get_(userID, pathStr, defaultValue, query)
					.then(resolve)
					.catch(reject);
			});
		});
	}

	async function set(userID, updateData, pathStr, query) {
		return new Promise((resolve, reject) => {
			taskQueue.push(async function () {
				try {
					if (!userID || (typeof userID != "string" && typeof userID != "number"))
						throw new CustomError({
							name: "INVALID_USER_ID",
							message: `The first argument (userID) must be a string or number, not a ${typeof userID}`
						});

					const strUserID = String(userID);
					if (!pathStr && (typeof updateData != "object" || Array.isArray(updateData)))
						throw new CustomError({
							name: "INVALID_UPDATE_DATA",
							message: `The second argument (updateData) must be an object, not a ${typeof updateData}`
						});

					if (!global.db.allBankData.some(u => u.userID == strUserID)) {
						await create(strUserID);
					}

					const bankDataResult = await save(strUserID, updateData, "update", pathStr);
					if (query) {
						if (typeof query !== "string")
							throw new CustomError({
								name: "INVALID_QUERY",
								message: `The fourth argument (query) must be a string, not a ${typeof query}`
							});
						return resolve(_.cloneDeep(fakeGraphql(query, bankDataResult)));
					}
					return resolve(_.cloneDeep(bankDataResult));
				}
				catch (err) {
					reject(err);
				}
			});
		});
	}

	async function deleteKey(userID, pathStr, query) {
		return new Promise((resolve, reject) => {
			taskQueue.push(async function () {
				try {
					const strUserID = String(userID);
					if (!global.db.allBankData.some(u => u.userID == strUserID)) {
						throw new CustomError({
							name: "BANK_NOT_FOUND",
							message: `Bank data for userID "${strUserID}" does not exist in the data`
						});
					}
					if (typeof pathStr !== "string")
						throw new CustomError({
							name: "INVALID_PATH",
							message: `The second argument (path) must be a string, not a ${typeof pathStr}`
						});

					const splitPath = pathStr.split(".");
					if (splitPath.length == 1)
						throw new CustomError({
							name: "INVALID_PATH",
							message: `Can't delete key "${pathStr}" because it's a root key`
						});

					const parent = splitPath.slice(0, splitPath.length - 1).join(".");
					const parentData = await get_(strUserID, parent);
					if (!parentData)
						throw new CustomError({
							name: "INVALID_PATH",
							message: `Can't find key "${parent}" in bank data`
						});

					_.unset(parentData, splitPath[splitPath.length - 1]);
					const setData = await save(strUserID, parentData, "update", parent);
					if (query) {
						if (typeof query !== "string")
							throw new CustomError({
								name: "INVALID_QUERY",
								message: `The fourth argument (query) must be a string, not a ${typeof query}`
							});
						return resolve(_.cloneDeep(fakeGraphql(query, setData)));
					}
					return resolve(_.cloneDeep(setData));
				}
				catch (err) {
					reject(err);
				}
			});
		});
	}

	async function remove(userID) {
		return new Promise((resolve, reject) => {
			taskQueue.push(async function () {
				try {
					const strUserID = String(userID);
					await save(strUserID, { userID: strUserID }, "remove");
					return resolve(true);
				}
				catch (err) {
					reject(err);
				}
			});
		});
	}

	return {
		existsSync: function existsSync(userID) {
			return global.db.allBankData.some(u => u.userID == String(userID));
		},
		create,
		getAll,
		get,
		set,
		deleteKey,
		remove
	};
};
