const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("banks", {
        userID: { type: DataTypes.STRING, primaryKey: true, unique: true },
        balance: { type: DataTypes.FLOAT, defaultValue: 0 },
        savings: { type: DataTypes.FLOAT, defaultValue: 0 },
        vault: { type: DataTypes.FLOAT, defaultValue: 0 },
        loan: { type: DataTypes.FLOAT, defaultValue: 0 },
        loanDate: { type: DataTypes.BIGINT, defaultValue: null },
        creditScore: { type: DataTypes.INTEGER, defaultValue: 600 },
        bankLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
        premium: { type: DataTypes.BOOLEAN, defaultValue: false },
        multiplier: { type: DataTypes.FLOAT, defaultValue: 1 },
        streak: { type: DataTypes.INTEGER, defaultValue: 0 },
        reputation: { type: DataTypes.INTEGER, defaultValue: 0 },
        lastInterest: { type: DataTypes.BIGINT, defaultValue: () => Date.now() },
        transactions: { type: DataTypes.JSON, defaultValue: [] },
        achievements: { type: DataTypes.JSON, defaultValue: [] },
        stocks: { type: DataTypes.JSON, defaultValue: {} },
        crypto: { type: DataTypes.JSON, defaultValue: {} },
        realEstate: { type: DataTypes.JSON, defaultValue: [] },
        businesses: { type: DataTypes.JSON, defaultValue: [] },
        vehicles: { type: DataTypes.JSON, defaultValue: [] },
        skills: { type: DataTypes.JSON, defaultValue: { gambling: 0, trading: 0, business: 0, investing: 0 } }
    });
};
