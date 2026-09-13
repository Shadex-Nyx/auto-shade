const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema({
    userID: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    savings: { type: Number, default: 0 },
    vault: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    loanDate: { type: Number, default: null },
    creditScore: { type: Number, default: 600 },
    bankLevel: { type: Number, default: 1 },
    premium: { type: Boolean, default: false },
    multiplier: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    lastInterest: { type: Number, default: Date.now },
    transactions: { type: Array, default: [] },
    achievements: { type: Array, default: [] },
    stocks: { type: Object, default: {} },
    crypto: { type: Object, default: {} },
    realEstate: { type: Array, default: [] },
    businesses: { type: Array, default: [] },
    vehicles: { type: Array, default: [] },
    skills: { type: Object, default: { gambling: 0, trading: 0, business: 0, investing: 0 } }
}, { minimize: false });

module.exports = mongoose.model("banks", bankSchema);
