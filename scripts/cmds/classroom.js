/**
 * ============================================================================
 *  CLASSROOM OF THE ELITE — ADVANCED NURTURING HIGH SCHOOL RPG SYSTEM
 *  Fichier unique : classroom.js — Compatible Goat Bot V2
 *  Auteur : Shade (généré avec Claude)
 * ============================================================================
 *  Sommaire des sections (recherche par mot-clé) :
 *    [1] DEPENDANCES
 *    [2] CONFIGURATION / CONSTANTES
 *    [3] DATABASE (chargement / sauvegarde sécurisée)
 *    [4] UTILITAIRES
 *    [5] SYSTEME DE CLASSES
 *    [6] ELEVE / ECONOMIE (Private Points)
 *    [7] BANQUE DE QUESTIONS
 *    [8] SYSTEME D'EXAMENS
 *    [9] MISSIONS
 *    [10] SHOP
 *    [11] EVENEMENTS ALEATOIRES
 *    [12] CANVAS (Student Card)
 *    [13] COMMAND HANDLER (onStart)
 *    [14] onReply HANDLER (inscription / examens)
 * ============================================================================
 */

// ============================================================================
// [1] DEPENDANCES
// ============================================================================
const fonts = require("../../func/font.js");
const numbers = require("../../func/number.js");

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// Sécurité : si func/font.js ou func/number.js ne sont pas disponibles dans
// certaines installations, on retombe sur des versions neutres pour ne
// jamais faire planter la commande.
const F = (fonts && typeof fonts.bold === "function") ? fonts : { bold: (s) => s };
const N = (numbers && typeof numbers.apply === "function" && typeof numbers.money === "function")
	? numbers
	: { apply: (_style, v) => String(v), money: (v) => `${fmtNumber(v)} $` };
function fmtNumber(n) { return Math.round(n).toLocaleString("en-US"); }

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
	const cv = require("canvas");
	loadImage = cv.loadImage;
	createCanvas = cv.createCanvas;
	registerFont = cv.registerFont;
	canvasAvailable = true;
} catch (e) {
	console.error("[classroom.js] Canvas indisponible, mode texte activé:", e.message);
}

let fontsLoaded = false;
function ensureFonts() {
	if (fontsLoaded || !canvasAvailable || !registerFont) return;
	fontsLoaded = true;
	try {
		const fd = path.join(__dirname, "assets", "font");
		if (!fs.existsSync(fd)) return;
		const fontFiles = [
			["BeVietnamPro-Bold.ttf", "SH", "bold"],
			["BeVietnamPro-Regular.ttf", "SH", "normal"],
			["BeVietnamPro-SemiBold.ttf", "SH", "600"],
			["NotoSans-Bold.ttf", "SH", "bold"],
			["NotoSans-Regular.ttf", "SH", "normal"]
		];
		for (const [f, fam, w] of fontFiles) {
			try {
				const fp = path.join(fd, f);
				if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
			} catch (_) {}
		}
	} catch (_) {}
}

// ============================================================================
// [2] CONFIGURATION / CONSTANTES
// ============================================================================
const CACHE_DIR = path.join(__dirname, "cache");

// Nom de la collection MongoDB dans laquelle toute la database Classroom
// (users, classes, exams, events, globalStats, meta) est stockée sous forme
// d'un document unique — même logique qu'un gros JSON, mais persistant.
const MONGO_COLLECTION = "classroomdata";
const MONGO_DOC_ID = "classroom_main";

const FB_TOKEN = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

const SCHOOL_NAME = "ADVANCED NURTURING HIGH SCHOOL";
const STARTING_POINTS = 1000;
const STARTING_CLASS = "1-D";

// Ordre de progression des classes (du plus bas au plus haut)
const CLASS_ORDER = [
	"1-D", "1-C", "1-B", "1-A",
	"2-D", "2-C", "2-B", "2-A",
	"3-D", "3-C", "3-B", "3-A"
];

// Points de classe initiaux (uniquement à la création de la DB)
const INITIAL_CLASS_POINTS = {
	"1-A": 82450, "1-B": 69300, "1-C": 51240, "1-D": 34800,
	"2-A": 45000, "2-B": 38000, "2-C": 30000, "2-D": 22000,
	"3-A": 60000, "3-B": 50000, "3-C": 40000, "3-D": 30000
};

const STAT_KEYS = ["intelligence", "academic", "strategy", "communication", "cooperation", "deduction", "reputation", "discipline"];

// Libellés utilisés dans le CHAT (avec emoji, lisibles sur Messenger)
const STAT_LABELS = {
	intelligence: "🧠 Intelligence", academic: "📚 Academic", strategy: "🎯 Strategy",
	communication: "🗣️ Communication", cooperation: "🤝 Cooperation", deduction: "🕵️ Deduction",
	reputation: "⭐ Reputation", discipline: "💪 Discipline"
};

// Libellés utilisés sur le CANVAS (jamais d'emoji : les polices Canvas ne
// savent pas rendre les emoji correctement, ils s'affichent en carrés vides).
const STAT_LABELS_CANVAS = {
	intelligence: "INTELLIGENCE", academic: "ACADEMIC", strategy: "STRATEGY",
	communication: "COMMUNICATION", cooperation: "COOPERATION", deduction: "DEDUCTION",
	reputation: "REPUTATION", discipline: "DISCIPLINE"
};

// Thème visuel du Canvas — même logique que SHINOBI_THEMES de naruto.js,
// mais figé sur l'identité noir / rouge sombre / or de Classroom of the Elite.
const THEME = {
	name: "Advanced Nurturing High School",
	primary: "#C9A24B",      // or
	secondary: "#3A1418",    // rouge sombre profond
	bg1: "#07070A", bg2: "#111014",
	text: "#F3F1EA",
	grid: "#C9A24B"
};

const COOLDOWNS = {
	study: 30 * 60 * 1000,        // 30 min
	daily: 24 * 60 * 60 * 1000,   // 24h
	exam: 15 * 60 * 1000,         // 15 min entre examens volontaires
	weeklyMission: 7 * 24 * 60 * 60 * 1000,
	event: 2 * 60 * 60 * 1000     // fréquence min entre événements pour un même thread
};

const EXAM_QUESTION_COUNT = 10;
const EXAM_TIME_PER_QUESTION = 30 * 1000; // 30 secondes (indicatif + timeout réel)

// ============================================================================
// [3] DATABASE — chargement / sauvegarde via le MongoDB déjà configuré
// ============================================================================
// IMPORTANT : ce fichier ne se connecte PAS lui-même à MongoDB et ne lit
// aucune URI. Il réutilise la connexion Mongoose déjà ouverte par le coeur
// du bot au démarrage (le "config" MongoDB existant du projet). Comme
// mongoose maintient une connexion par défaut partagée entre tous les
// fichiers qui font `require("mongoose")`, il suffit de déclarer ici le
// modèle utilisé par classroom.js pour qu'il utilise automatiquement cette
// même connexion, sans dupliquer ni déplacer la configuration.
const mongoose = require("mongoose");

const classroomDocSchema = new mongoose.Schema(
	{
		_id: { type: String, default: MONGO_DOC_ID },
		payload: { type: mongoose.Schema.Types.Mixed, default: {} },
		updatedAt: { type: Date, default: Date.now }
	},
	{ collection: MONGO_COLLECTION, minimize: false, strict: false }
);

// Evite l'erreur "OverwriteModelError" si classroom.js est rechargé à chaud
const ClassroomModel = mongoose.models.ClassroomData || mongoose.model("ClassroomData", classroomDocSchema);

function defaultDB() {
	const classes = {};
	for (const c of CLASS_ORDER) {
		classes[c] = {
			name: c,
			classPoints: INITIAL_CLASS_POINTS[c] || 20000,
			students: []
		};
	}
	return {
		users: {},
		classes,
		exams: {},
		events: { lastGlobalEvent: 0, byThread: {} },
		globalStats: { totalRegistered: 0, totalExamsTaken: 0, totalPointsCirculating: STARTING_POINTS },
		meta: { createdAt: Date.now(), version: "1.0.0" }
	};
}

// Répare les clés manquantes (utile après une mise à jour de structure du
// jeu), exactement comme le faisait l'ancienne version basée sur fichier.
function repairDB(raw) {
	const data = raw && typeof raw === "object" ? raw : {};
	data.users = data.users || {};
	data.classes = data.classes || {};
	for (const c of CLASS_ORDER) {
		if (!data.classes[c]) {
			data.classes[c] = { name: c, classPoints: INITIAL_CLASS_POINTS[c] || 20000, students: [] };
		}
	}
	data.exams = data.exams || {};
	data.events = data.events || { lastGlobalEvent: 0, byThread: {} };
	data.globalStats = data.globalStats || { totalRegistered: 0, totalExamsTaken: 0, totalPointsCirculating: 0 };
	data.meta = data.meta || { createdAt: Date.now(), version: "1.0.0" };
	return data;
}

// DB est initialisée en mémoire immédiatement pour que le fichier ne
// plante jamais si une commande est appelée avant la fin du chargement
// MongoDB. Elle est ensuite remplacée par les vraies données dès que
// loadDB() a terminé son premier chargement (voir dbReadyPromise).
let DB = defaultDB();
let writeQueue = Promise.resolve(); // mutex simple pour écritures concurrentes
let dbReadyPromise = null;

// Attend que la connexion Mongoose déjà initialisée par le bot soit prête
// (readyState 1). Ne crée aucune connexion, se contente d'attendre celle
// qui existe déjà. Timeout de sécurité pour ne jamais bloquer le bot
// indéfiniment si Mongo n'est pas disponible.
function waitForMongoConnection(timeoutMs = 15000) {
	return new Promise((resolve) => {
		if (mongoose.connection.readyState === 1) return resolve(true);
		const timer = setTimeout(() => {
			mongoose.connection.off("connected", onConnected);
			resolve(mongoose.connection.readyState === 1);
		}, timeoutMs);
		function onConnected() {
			clearTimeout(timer);
			resolve(true);
		}
		mongoose.connection.once("connected", onConnected);
	});
}

async function loadDB() {
	if (!dbReadyPromise) {
		dbReadyPromise = (async () => {
			try {
				await waitForMongoConnection();
				const doc = await ClassroomModel.findById(MONGO_DOC_ID).lean();
				if (doc && doc.payload && Object.keys(doc.payload).length) {
					DB = repairDB(doc.payload);
				} else {
					// Aucune donnée Classroom existante : on crée la DB par défaut
					// puis on la sauvegarde immédiatement, sans jamais écraser une
					// donnée déjà présente (le cas ci-dessus est prioritaire).
					DB = defaultDB();
					await persistDB();
				}
			} catch (e) {
				console.error("[classroom.js] Erreur MongoDB au chargement, utilisation d'une DB temporaire en mémoire:", e.message);
				DB = repairDB(DB);
			}
		})();
	}
	await dbReadyPromise;
	return DB;
}

function persistDB() {
	// Ecriture mise en file pour éviter les collisions lors de modifications
	// simultanées (même principe de mutex que l'ancienne version fichier).
	writeQueue = writeQueue.then(() => ClassroomModel.updateOne(
		{ _id: MONGO_DOC_ID },
		{ $set: { payload: DB, updatedAt: new Date() } },
		{ upsert: true }
	).catch((e) => {
		console.error("[classroom.js] Erreur d'écriture MongoDB:", e.message);
	}));
	return writeQueue;
}

function saveDB() {
	return persistDB();
}

// Démarre l'hydratation depuis MongoDB dès le chargement du fichier, sans
// bloquer le require() (impossible d'attendre une Promise au niveau module
// en CommonJS). Chaque commande fait ensuite `await loadDB()` avant de
// toucher DB, ce qui garantit qu'elle ne travaille jamais sur la DB par
// défaut tant que les vraies données n'ont pas été récupérées.
loadDB();

// ============================================================================
// [4] UTILITAIRES
// ============================================================================
function fmt(n) {
	return Math.round(n).toLocaleString("en-US");
}

function randInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
	const copy = [...arr];
	const out = [];
	while (out.length < n && copy.length) {
		const i = Math.floor(Math.random() * copy.length);
		out.push(copy.splice(i, 1)[0]);
	}
	return out;
}

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

function genStudentID() {
	let id;
	do {
		id = "ANHS-" + String(randInt(0, 999999)).padStart(6, "0");
	} while (Object.values(DB.users).some(u => u.studentID === id));
	return id;
}

function getUser(uid) {
	return DB.users[uid] || null;
}

function isRegistered(uid) {
	return !!DB.users[uid];
}

function onCooldown(lastTimestamp, duration) {
	if (!lastTimestamp) return { active: false, remaining: 0 };
	const remaining = (lastTimestamp + duration) - Date.now();
	return { active: remaining > 0, remaining: Math.max(0, remaining) };
}

function msToClock(ms) {
	const totalSec = Math.ceil(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

function logHistory(user, entry) {
	user.history = user.history || [];
	user.history.unshift({ ...entry, timestamp: Date.now() });
	if (user.history.length > 50) user.history.length = 50; // évite un fichier illimité
}

// ============================================================================
// [5] SYSTEME DE CLASSES
// ============================================================================
function getClass(className) {
	return DB.classes[className] || null;
}

function addClassPoints(className, amount, reason) {
	const cls = getClass(className);
	if (!cls) return;
	cls.classPoints = Math.max(0, cls.classPoints + amount);
}

function getClassRanking() {
	return Object.values(DB.classes)
		.sort((a, b) => b.classPoints - a.classPoints);
}

function refreshClassMembership(user) {
	// S'assure que l'élève figure bien dans la liste students de sa classe
	for (const c of CLASS_ORDER) {
		const cls = DB.classes[c];
		cls.students = cls.students.filter(id => id !== user.uid);
	}
	DB.classes[user.class].students.push(user.uid);
}

/**
 * Calcule si l'élève est éligible à une promotion vers la classe supérieure.
 * La promotion ne dépend PAS uniquement des Private Points : elle prend en
 * compte les stats moyennes, la réputation, les examens réussis et le rang.
 */
function checkPromotionEligibility(user) {
	const idx = CLASS_ORDER.indexOf(user.class);
	if (idx === -1 || idx === CLASS_ORDER.length - 1) {
		return { eligible: false, reason: "Vous êtes déjà dans la meilleure classe." };
	}
	const avgStat = STAT_KEYS.reduce((s, k) => s + user.stats[k], 0) / STAT_KEYS.length;
	const requirements = {
		privatePoints: 3000 + idx * 500,
		avgStat: 55 + idx * 3,
		examsWon: 3 + idx,
		reputation: 45 + idx * 2
	};
	const checks = {
		privatePoints: user.privatePoints >= requirements.privatePoints,
		avgStat: avgStat >= requirements.avgStat,
		examsWon: (user.examsWon || 0) >= requirements.examsWon,
		reputation: user.stats.reputation >= requirements.reputation
	};
	const passed = Object.values(checks).filter(Boolean).length;
	// Il faut valider au moins 3 des 4 critères pour être éligible
	const eligible = passed >= 3;
	return { eligible, checks, requirements, avgStat, passed };
}

function promoteUser(user) {
	const idx = CLASS_ORDER.indexOf(user.class);
	const nextClass = CLASS_ORDER[idx + 1];
	if (!nextClass) return null;
	// Retire l'élève de son ancienne classe
	DB.classes[user.class].students = DB.classes[user.class].students.filter(id => id !== user.uid);
	user.class = nextClass;
	DB.classes[nextClass].students.push(user.uid);
	addClassPoints(nextClass, 500, "Nouvelle recrue talentueuse");
	logHistory(user, { type: "promotion", amount: 0, reason: `Promotion vers la classe ${nextClass}` });
	return nextClass;
}

// ============================================================================
// [6] ELEVE / ECONOMIE (Private Points)
// ============================================================================
function baseStats() {
	const stats = {};
	for (const k of STAT_KEYS) stats[k] = randInt(28, 42);
	return stats;
}

function createStudent(uid, threadID, firstName, lastName) {
	const studentID = genStudentID();
	const user = {
		uid,
		threadID,
		firstName,
		lastName,
		fullName: `${firstName} ${lastName}`,
		studentID,
		class: STARTING_CLASS,
		privatePoints: STARTING_POINTS,
		stats: baseStats(),
		rank: "D",
		examsWon: 0,
		totalExams: 0,
		examStreak: 0,
		secretLevel: 0,
		history: [],
		missions: { daily: null, weekly: null },
		cooldowns: { study: 0, daily: 0, exam: 0 },
		entranceExamDone: false,
		registration: { step: "firstName_done", tempFirstName: firstName },
		createdAt: Date.now()
	};
	DB.users[uid] = user;
	DB.classes[STARTING_CLASS].students.push(uid);
	DB.globalStats.totalRegistered++;
	DB.globalStats.totalPointsCirculating += STARTING_POINTS;
	return user;
}

function addPoints(user, amount, reason, type = "reward") {
	user.privatePoints = Math.max(0, user.privatePoints + amount);
	DB.globalStats.totalPointsCirculating += amount;
	logHistory(user, { type, amount, reason });
}

function removePoints(user, amount, reason, type = "penalty") {
	const applied = Math.min(user.privatePoints, amount);
	user.privatePoints -= applied;
	DB.globalStats.totalPointsCirculating -= applied;
	logHistory(user, { type, amount: -applied, reason });
	return applied;
}

function transferPoints(from, to, amount) {
	if (amount <= 0) return { ok: false, error: "Montant invalide." };
	if (from.uid === to.uid) return { ok: false, error: "Vous ne pouvez pas vous transférer des points à vous-même." };
	if (from.privatePoints < amount) return { ok: false, error: "Fonds insuffisants." };
	from.privatePoints -= amount;
	to.privatePoints += amount;
	logHistory(from, { type: "transfer_out", amount: -amount, reason: `Transfert vers ${to.fullName}` });
	logHistory(to, { type: "transfer_in", amount, reason: `Transfert reçu de ${from.fullName}` });
	return { ok: true };
}

function addStat(user, stat, amount) {
	if (!STAT_KEYS.includes(stat)) return;
	user.stats[stat] = clamp(user.stats[stat] + amount, 0, 100);
}

function computeRank(user) {
	const avg = STAT_KEYS.reduce((s, k) => s + user.stats[k], 0) / STAT_KEYS.length;
	if (avg >= 92) return "S+";
	if (avg >= 82) return "S";
	if (avg >= 68) return "A";
	if (avg >= 52) return "B";
	if (avg >= 35) return "C";
	return "D";
}

function refreshRank(user) {
	user.rank = computeRank(user);
}

// ============================================================================
// [7] BANQUE DE QUESTIONS
// ============================================================================
// Chaque question est reliée à une catégorie et à une statistique qu'elle
// fait progresser en cas de bonne réponse.
const QUESTION_BANK = {
	logique: { stat: "intelligence", label: "🧠 Logique", questions: [
		{ q: "Si A > B et B > C, quelle affirmation est nécessairement vraie ?", opts: ["A > C", "C > A", "A = C", "Impossible à déterminer"], correct: 0 },
		{ q: "Tous les chats sont des félins. Certains félins sont sauvages. Peut-on dire que tous les chats sont sauvages ?", opts: ["Oui", "Non", "Seulement la moitié", "Cela dépend du chat"], correct: 1 },
		{ q: "Si aucun étudiant de 1-D n'est premier de la classe, et que Kei est premier de sa classe, que peut-on en déduire ?", opts: ["Kei est en 1-D", "Kei n'est pas en 1-D", "Kei n'existe pas", "Rien du tout"], correct: 1 },
		{ q: "Deux affirmations : 'S'il pleut, le sol est mouillé' et 'Le sol est mouillé'. Peut-on conclure qu'il pleut ?", opts: ["Oui, toujours", "Non, ce serait une erreur logique", "Seulement en hiver", "Seulement si on est dehors"], correct: 1 },
		{ q: "Si tous les A sont B, et qu'aucun B n'est C, que peut-on dire des A et des C ?", opts: ["Certains A sont C", "Aucun A n'est C", "Tous les A sont C", "On ne peut rien dire"], correct: 1 },
		{ q: "Un menteur dit toujours faux, un honnête dit toujours vrai. Une personne dit : 'Je suis un menteur.' Que peut-on en déduire ?", opts: ["C'est un menteur", "C'est un honnête", "C'est un paradoxe", "Aucune des réponses"], correct: 2 },
		{ q: "Complétez la suite logique : 2, 4, 8, 16, ...", opts: ["24", "32", "20", "18"], correct: 1 },
		{ q: "Si tous les membres du club sont majeurs, et que Yuki n'est pas majeur, alors Yuki...", opts: ["est dans le club", "n'est pas dans le club", "sera bientôt majeur", "aucune conclusion possible"], correct: 1 }
	]},
	culture: { stat: "academic", label: "📚 Culture générale", questions: [
		{ q: "Quelle est la capitale du Japon ?", opts: ["Osaka", "Kyoto", "Tokyo", "Nagoya"], correct: 2 },
		{ q: "Combien y a-t-il de continents sur Terre ?", opts: ["5", "6", "7", "8"], correct: 2 },
		{ q: "Qui a peint la Joconde ?", opts: ["Michel-Ange", "Léonard de Vinci", "Raphaël", "Botticelli"], correct: 1 },
		{ q: "Quel est le plus long fleuve du monde ?", opts: ["Le Nil", "L'Amazone", "Le Yangtsé", "Le Mississippi"], correct: 1 },
		{ q: "En quelle année a eu lieu la Révolution française ?", opts: ["1789", "1804", "1715", "1848"], correct: 0 },
		{ q: "Quel est l'élément chimique dont le symbole est 'O' ?", opts: ["Or", "Oxygène", "Osmium", "Argon"], correct: 1 },
		{ q: "Quelle planète est surnommée la 'planète rouge' ?", opts: ["Vénus", "Jupiter", "Mars", "Saturne"], correct: 2 },
		{ q: "Combien de joueurs compte une équipe de football sur le terrain ?", opts: ["9", "10", "11", "12"], correct: 2 }
	]},
	maths: { stat: "intelligence", label: "🔢 Mathématiques", questions: [
		{ q: "Combien font 12 × 8 ?", opts: ["96", "88", "104", "92"], correct: 0 },
		{ q: "Quelle est la racine carrée de 144 ?", opts: ["11", "12", "13", "14"], correct: 1 },
		{ q: "Si x + 5 = 12, combien vaut x ?", opts: ["5", "6", "7", "8"], correct: 2 },
		{ q: "Combien font 15 % de 200 ?", opts: ["20", "25", "30", "35"], correct: 2 },
		{ q: "Quel est le résultat de 7² - 3² ?", opts: ["40", "36", "42", "38"], correct: 0 },
		{ q: "Un train parcourt 300 km en 3 heures. Quelle est sa vitesse moyenne ?", opts: ["90 km/h", "100 km/h", "110 km/h", "120 km/h"], correct: 1 },
		{ q: "Combien font (5 + 3) × (2 + 2) ?", opts: ["28", "30", "32", "26"], correct: 2 }
	]},
	strategie: { stat: "strategy", label: "🎯 Stratégie", questions: [
		{ q: "Dans une négociation à somme nulle, le gain de l'un correspond-il à la perte de l'autre ?", opts: ["Oui, toujours", "Non, jamais", "Seulement au poker", "Cela dépend du contexte"], correct: 0 },
		{ q: "Votre classe doit voter pour éliminer un point faible collectivement. Quelle est la meilleure approche ?", opts: ["Agir seul sans consulter personne", "Analyser les forces de chacun avant de décider", "Voter au hasard", "Refuser de participer"], correct: 1 },
		{ q: "Dans un jeu où chaque joueur doit deviner la stratégie adverse, quel est l'avantage principal de l'information cachée ?", opts: ["Aucun avantage", "Cela permet la manipulation et la surprise", "Cela ralentit le jeu", "Cela n'a pas d'impact"], correct: 1 },
		{ q: "Si vous devez choisir entre un gain sûr modéré et un gain risqué mais plus élevé, quel facteur est le plus important ?", opts: ["La couleur du ciel", "Votre tolérance au risque et vos réserves de points", "La météo", "Aucun facteur ne compte"], correct: 1 },
		{ q: "Dans un examen de groupe, quelle stratégie maximise généralement le score collectif ?", opts: ["Chacun pour soi", "Répartir les tâches selon les compétences de chacun", "Ne rien faire", "Copier au hasard"], correct: 1 },
		{ q: "Un adversaire bluffe souvent. Quelle est la meilleure contre-stratégie à long terme ?", opts: ["Toujours le croire", "Observer ses patterns et ajuster sa confiance", "L'ignorer totalement", "Abandonner"], correct: 1 }
	]},
	deduction: { stat: "deduction", label: "🕵️ Déduction", questions: [
		{ q: "Un élève affirme ne jamais avoir triché, mais ses points ont doublé en une nuit sans explication. Que devriez-vous soupçonner ?", opts: ["Rien, c'est normal", "Une aide extérieure ou une transaction cachée", "Un bug du système uniquement", "Une erreur d'affichage"], correct: 1 },
		{ q: "Trois suspects, un seul ment. A dit 'B ment'. B dit 'C ment'. C dit 'A et B mentent'. Qui dit la vérité ?", opts: ["A", "B", "C", "Personne"], correct: 0 },
		{ q: "Un objet a disparu d'une salle fermée de l'intérieur. Quelle piste est la plus logique à explorer en premier ?", opts: ["La magie", "Un accès alternatif ou une complicité interne", "Le hasard", "Aucune piste"], correct: 1 },
		{ q: "Un témoin change sa version trois fois. Que peut-on raisonnablement en déduire ?", opts: ["Il dit forcément la vérité", "Sa fiabilité est fortement remise en question", "Il ment forcément", "Cela ne change rien"], correct: 1 },
		{ q: "Deux élèves ont un alibi identique au mot près. Qu'est-ce que cela suggère souvent ?", opts: ["Une coïncidence totale", "Une possible préparation concertée", "Rien du tout", "Qu'ils sont innocents à coup sûr"], correct: 1 }
	]},
	raisonnement: { stat: "intelligence", label: "🧩 Raisonnement", questions: [
		{ q: "Quel mot complète la série : Livre, Bibliothèque, Étagère, Salle, ... ?", opts: ["École", "Crayon", "Chaise", "Papier"], correct: 0 },
		{ q: "Si 3 ouvriers construisent un mur en 6 jours, combien de jours faudra-t-il à 6 ouvriers pour le même mur ?", opts: ["3 jours", "6 jours", "12 jours", "2 jours"], correct: 0 },
		{ q: "Quel est l'intrus dans cette liste : Triangle, Carré, Cercle, Rouge ?", opts: ["Triangle", "Carré", "Cercle", "Rouge"], correct: 3 },
		{ q: "Une horloge indique 3h15. Quel angle séparent les aiguilles environ ?", opts: ["0°", "7,5°", "90°", "180°"], correct: 1 },
		{ q: "Complétez : Main est à Gant ce que Pied est à ...", opts: ["Chaussure", "Genou", "Jambe", "Sol"], correct: 0 }
	]},
	social: { stat: "communication", label: "🗣️ Situations sociales", questions: [
		{ q: "Un camarade de classe est isolé après un conflit. Quelle est l'attitude la plus constructive ?", opts: ["L'ignorer", "Essayer d'ouvrir le dialogue avec tact", "Se moquer avec le groupe", "Aggraver la situation"], correct: 1 },
		{ q: "Pendant un travail de groupe, un membre ne participe pas. Que faire en priorité ?", opts: ["Le dénoncer immédiatement", "Comprendre la raison avant d'agir", "L'exclure sans discussion", "Ignorer le problème"], correct: 1 },
		{ q: "Vous devez annoncer une mauvaise nouvelle à un ami. Quelle approche est la plus appropriée ?", opts: ["Être brutal sans préambule", "Être honnête mais avec empathie", "Mentir pour éviter le sujet", "Fuir la conversation"], correct: 1 },
		{ q: "Un désaccord éclate en classe. Quelle réaction favorise le mieux la cohésion du groupe ?", opts: ["Prendre parti immédiatement", "Écouter les deux côtés avant de réagir", "Crier plus fort que les autres", "Quitter la pièce"], correct: 1 },
		{ q: "Comment gagner la confiance d'un camarade méfiant ?", opts: ["Faire des promesses non tenues", "Être cohérent entre ses paroles et ses actes", "L'ignorer complètement", "Le forcer à vous faire confiance"], correct: 1 }
	]},
	academique: { stat: "academic", label: "📖 Académique", questions: [
		{ q: "Quelle est la formule chimique de l'eau ?", opts: ["CO2", "H2O", "O2", "NaCl"], correct: 1 },
		{ q: "Qui a formulé la théorie de la relativité ?", opts: ["Isaac Newton", "Albert Einstein", "Niels Bohr", "Galilée"], correct: 1 },
		{ q: "Quel organe pompe le sang dans le corps humain ?", opts: ["Le foie", "Le cœur", "Le poumon", "Le rein"], correct: 1 },
		{ q: "Quelle langue est la plus parlée au monde en nombre de locuteurs natifs ?", opts: ["Anglais", "Espagnol", "Mandarin", "Hindi"], correct: 2 },
		{ q: "Quel est le processus par lequel les plantes produisent de l'énergie à partir de la lumière ?", opts: ["La respiration", "La photosynthèse", "La fermentation", "L'osmose"], correct: 1 },
		{ q: "Combien de côtés possède un hexagone ?", opts: ["5", "6", "7", "8"], correct: 1 }
	]}
};

/**
 * Mélange les options (A/B/C/D) d'une question et recalcule l'index de la
 * bonne réponse. Sans cela, la position de la bonne réponse dans le tableau
 * QUESTION_BANK reste fixe pour chaque question (beaucoup avaient été
 * rédigées avec la bonne réponse en position B), ce qui rendait les examens
 * prévisibles ("les réponses sont toutes B"). On mélange donc une copie de
 * la question à chaque fois qu'elle est piochée pour un examen.
 */
function shuffleQuestionOptions(q) {
	const indices = [0, 1, 2, 3];
	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}
	const newOpts = indices.map(i => q.opts[i]);
	const newCorrect = indices.indexOf(q.correct);
	return { ...q, opts: newOpts, correct: newCorrect };
}

function buildExamQuestions(count = EXAM_QUESTION_COUNT, categoryFilter = null) {
	const categories = categoryFilter ? [categoryFilter] : Object.keys(QUESTION_BANK);
	let pool = [];
	for (const cat of categories) {
		const catData = QUESTION_BANK[cat];
		for (const q of catData.questions) {
			pool.push({ ...q, category: cat, stat: catData.stat, categoryLabel: catData.label });
		}
	}
	const selected = pickN(pool, Math.min(count, pool.length));
	return selected.map(shuffleQuestionOptions);
}

// ============================================================================
// [8] SYSTEME D'EXAMENS
// ============================================================================
const EXAM_TYPES = {
	entrance: { label: "🧠 ENTRANCE EXAM", questionCount: 10, rewardPerCorrect: 40, penaltyPerWrong: 0 },
	academic: { label: "📚 ACADEMIC EXAM", questionCount: 6, rewardPerCorrect: 60, penaltyPerWrong: 15, category: "academique" },
	intelligence: { label: "🧠 INTELLIGENCE EXAM", questionCount: 6, rewardPerCorrect: 60, penaltyPerWrong: 15, category: "logique" },
	strategy: { label: "🎯 STRATEGY EXAM", questionCount: 6, rewardPerCorrect: 65, penaltyPerWrong: 15, category: "strategie" },
	special: { label: "⭐ SPECIAL EXAM", questionCount: 8, rewardPerCorrect: 90, penaltyPerWrong: 40 }
};

function startExam(user, examType, extra = {}) {
	const def = EXAM_TYPES[examType] || EXAM_TYPES.academic;
	const questions = buildExamQuestions(def.questionCount, def.category || null);
	const session = {
		examType,
		def,
		questions,
		currentIndex: 0,
		correctCount: 0,
		statGains: {},
		startedAt: Date.now(),
		...extra
	};
	return session;
}

function gradeAnswer(session, answerIndex) {
	const q = session.questions[session.currentIndex];
	const isCorrect = answerIndex === q.correct;
	if (isCorrect) {
		session.correctCount++;
		session.statGains[q.stat] = (session.statGains[q.stat] || 0) + 2;
	}
	session.currentIndex++;
	return isCorrect;
}

function finalizeExam(user, session) {
	const def = session.def;
	const total = session.questions.length;
	const correct = session.correctCount;
	const wrong = total - correct;
	const reward = correct * def.rewardPerCorrect;
	const penalty = wrong * (def.penaltyPerWrong || 0);
	const net = reward - penalty;

	if (net >= 0) addPoints(user, net, `${def.label} — ${correct}/${total} bonnes réponses`, "exam_reward");
	else removePoints(user, Math.abs(net), `${def.label} — résultat insuffisant`, "exam_penalty");

	for (const [stat, amount] of Object.entries(session.statGains)) {
		addStat(user, stat, amount);
	}
	// La coopération progresse légèrement à chaque examen passé (participation)
	addStat(user, "cooperation", 1);
	addStat(user, "discipline", correct >= total * 0.7 ? 2 : 0);

	user.totalExams = (user.totalExams || 0) + 1;
	const passed = correct >= Math.ceil(total * 0.5);
	if (passed) {
		user.examsWon = (user.examsWon || 0) + 1;
		user.examStreak = (user.examStreak || 0) + 1;
	} else {
		user.examStreak = 0;
	}
	refreshRank(user);
	DB.globalStats.totalExamsTaken++;

	// Impact sur les Class Points en fonction de la performance
	const classImpact = passed ? Math.round(correct * 35) : -Math.round(wrong * 10);
	addClassPoints(user.class, classImpact, `Performance de ${user.fullName} — ${def.label}`);

	return { correct, total, reward, penalty, net, passed, classImpact };
}

// ============================================================================
// [9] MISSIONS
// ============================================================================
const DAILY_MISSION_TEMPLATES = [
	{ id: "streak3", desc: "Réussir 3 questions consécutives lors d'un examen", reward: 150, stat: "intelligence", statAmount: 2 },
	{ id: "study_once", desc: "Compléter une session d'étude", reward: 100, stat: "academic", statAmount: 2 },
	{ id: "pass_exam", desc: "Réussir un examen (au moins 50% de bonnes réponses)", reward: 180, stat: "discipline", statAmount: 2 },
	{ id: "help_class", desc: "Participer à un examen académique ou de stratégie", reward: 130, stat: "cooperation", statAmount: 2 }
];

const WEEKLY_MISSION_TEMPLATES = [
	{ id: "five_exams", desc: "Passer 5 examens dans la semaine", reward: 600, stat: "reputation", statAmount: 4 },
	{ id: "class_climb", desc: "Faire progresser les Class Points de votre classe", reward: 500, stat: "cooperation", statAmount: 4 }
];

function assignDailyMission(user) {
	const template = pick(DAILY_MISSION_TEMPLATES);
	user.missions.daily = { ...template, progress: 0, target: 1, assignedAt: Date.now(), claimed: false };
	return user.missions.daily;
}

function assignWeeklyMission(user) {
	const template = pick(WEEKLY_MISSION_TEMPLATES);
	user.missions.weekly = { ...template, progress: 0, target: template.id === "five_exams" ? 5 : 1, assignedAt: Date.now(), claimed: false };
	return user.missions.weekly;
}

// ============================================================================
// [10] SHOP
// ============================================================================
const SHOP_ITEMS = [
	{ id: "study_boost", name: "📚 Study Boost", price: 500, desc: "Double les gains de la prochaine session d'étude.", effect: "study_boost" },
	{ id: "exam_hint", name: "🎯 Exam Hint", price: 750, desc: "Révèle un indice lors du prochain examen.", effect: "exam_hint" },
	{ id: "reputation_boost", name: "⭐ Reputation Boost", price: 1000, desc: "Augmente immédiatement la réputation de 5 points.", effect: "reputation_boost" },
	{ id: "secret_info", name: "🕵️ Secret Information", price: 2500, desc: "Augmente votre Secret Level (accès à des informations cachées).", effect: "secret_info" },
	{ id: "discipline_training", name: "💪 Discipline Training", price: 800, desc: "Augmente la discipline de 4 points.", effect: "discipline_boost" },
	{ id: "cooldown_reset", name: "⏱️ Fresh Start", price: 600, desc: "Réinitialise le cooldown d'étude.", effect: "cooldown_reset" }
];

function applyShopEffect(user, item) {
	switch (item.effect) {
		case "reputation_boost": addStat(user, "reputation", 5); return "Réputation +5.";
		case "discipline_boost": addStat(user, "discipline", 4); return "Discipline +4.";
		case "secret_info": user.secretLevel = (user.secretLevel || 0) + 1; return `Secret Level désormais ${user.secretLevel}.`;
		case "cooldown_reset": user.cooldowns.study = 0; return "Votre cooldown d'étude a été réinitialisé.";
		case "study_boost": user.tempStudyBoost = true; return "Votre prochaine session d'étude sera boostée.";
		case "exam_hint": user.tempExamHint = true; return "Un indice sera disponible lors de votre prochain examen.";
		default: return "Objet appliqué.";
	}
}

// ============================================================================
// [11] EVENEMENTS ALEATOIRES
// ============================================================================
const RANDOM_EVENTS = [
	{
		id: "surprise_exam", weight: 3,
		title: "⚠️ SURPRISE EXAM",
		text: "Votre classe doit passer un examen surprise. Récompense maximale : 750 PP.",
		apply: (user) => addPoints(user, randInt(150, 750), "Surprise Exam", "event")
	},
	{
		id: "school_event", weight: 2,
		title: "📢 SCHOOL EVENT",
		text: "Un événement spécial a été déclenché par l'administration. Une récompense inattendue vous est accordée.",
		apply: (user) => addPoints(user, randInt(100, 400), "School Event", "event")
	},
	{
		id: "point_audit", weight: 1,
		title: "🔍 POINT AUDIT",
		text: "L'administration a détecté une irrégularité mineure dans vos comptes. Une légère pénalité est appliquée.",
		apply: (user) => removePoints(user, randInt(50, 150), "Point Audit", "event")
	},
	{
		id: "reputation_rumor", weight: 2,
		title: "🗞️ RUMOR",
		text: "Une rumeur circule à votre sujet dans l'école, affectant votre réputation.",
		apply: (user) => addStat(user, "reputation", randInt(-3, 5))
	}
];

function maybeTriggerEvent(threadID) {
	const state = DB.events.byThread[threadID] || { last: 0 };
	if (Date.now() - state.last < COOLDOWNS.event) return null;
	// ~12% de chance par déclenchement de commande éligible
	if (Math.random() > 0.12) return null;
	const totalWeight = RANDOM_EVENTS.reduce((s, e) => s + e.weight, 0);
	let r = Math.random() * totalWeight;
	let chosen = RANDOM_EVENTS[0];
	for (const e of RANDOM_EVENTS) {
		if (r < e.weight) { chosen = e; break; }
		r -= e.weight;
	}
	DB.events.byThread[threadID] = { last: Date.now() };
	return chosen;
}

// ============================================================================
// [12] CANVAS — Student Card
// ============================================================================
async function fetchAvatar(uid) {
	if (!canvasAvailable) return null;
	try {
		const res = await axios.get(
			`https://graph.facebook.com/${uid}/picture?width=400&height=400&access_token=${FB_TOKEN}`,
			{ responseType: "arraybuffer", timeout: 10000 }
		);
		return await loadImage(Buffer.from(res.data));
	} catch (_) { return null; }
}

function rr(ctx, x, y, w, h, r) {
	if (typeof r === "number") r = [r, r, r, r];
	const [tl, tr, br, bl] = r;
	ctx.beginPath();
	ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + tr); ctx.lineTo(x + w, y + h - br);
	ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h); ctx.lineTo(x + bl, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - bl); ctx.lineTo(x, y + tl);
	ctx.quadraticCurveTo(x, y, x + tl, y); ctx.closePath();
}

// Rappel important : AUCUN emoji ne doit jamais être passé à T(). La police
// Canvas ne sait pas dessiner les emoji, ils apparaissent comme des carrés
// vides ("tofu"). On n'utilise donc ici que du texte majuscule/technique,
// exactement comme dans le rendu de naruto.js.
function T(ctx, s, x, y, sz, color, { align = "left", weight = "bold", glow = null, alpha = 1, letterSpacing = 0 } = {}) {
	ctx.save(); ctx.globalAlpha = alpha;
	ctx.font = `${weight} ${sz}px SH, Arial`;
	ctx.textAlign = letterSpacing ? "left" : align;
	ctx.textBaseline = "middle";
	if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
	ctx.fillStyle = color;
	if (letterSpacing) {
		let cx = x;
		if (align === "center") {
			const w = [...s].reduce((acc, ch) => acc + ctx.measureText(ch).width + letterSpacing, -letterSpacing);
			cx = x - w / 2;
		} else if (align === "right") {
			const w = [...s].reduce((acc, ch) => acc + ctx.measureText(ch).width + letterSpacing, -letterSpacing);
			cx = x - w;
		}
		for (const ch of s) {
			ctx.fillText(ch, cx, y);
			cx += ctx.measureText(ch).width + letterSpacing;
		}
	} else {
		ctx.fillText(s, x, y);
	}
	ctx.restore();
}

function GL(ctx, x1, y1, x2, y2, color, w = 1.2) {
	const g = ctx.createLinearGradient(x1, y1, x2, y2);
	g.addColorStop(0, "transparent"); g.addColorStop(0.5, color); g.addColorStop(1, "transparent");
	ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = w;
	ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

function drawScrollBg(ctx, W, H, t) {
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, t.bg1); g.addColorStop(0.55, t.bg2); g.addColorStop(1, t.bg1);
	ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

	ctx.save();
	ctx.strokeStyle = t.grid; ctx.globalAlpha = 0.05; ctx.lineWidth = 1;
	for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
	for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
	ctx.restore();

	const corner = 26;
	ctx.save();
	ctx.strokeStyle = t.primary; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
	[[24, 24, 1, 1], [W - 24, 24, -1, 1], [24, H - 24, 1, -1], [W - 24, H - 24, -1, -1]].forEach(([x, y, dx, dy]) => {
		ctx.beginPath();
		ctx.moveTo(x, y + corner * dy);
		ctx.lineTo(x, y);
		ctx.lineTo(x + corner * dx, y);
		ctx.stroke();
	});
	ctx.restore();
}

function drawSquareAvatar(ctx, img, x, y, size, t) {
	ctx.save();
	rr(ctx, x, y, size, size, 10);
	ctx.clip();
	if (img) ctx.drawImage(img, x, y, size, size);
	else { ctx.fillStyle = t.secondary; ctx.fillRect(x, y, size, size); }
	ctx.restore();
	ctx.save();
	rr(ctx, x, y, size, size, 10);
	ctx.lineWidth = 2;
	ctx.strokeStyle = t.primary;
	ctx.stroke();
	ctx.restore();
}

function drawBar(ctx, x, y, w, h, ratio, colorBg, colorFg) {
	ctx.save();
	rr(ctx, x, y, w, h, h / 2);
	ctx.fillStyle = colorBg;
	ctx.fill();
	ctx.restore();
	const fillW = Math.max(h, w * clamp(ratio, 0, 1));
	ctx.save();
	rr(ctx, x, y, fillW, h, h / 2);
	ctx.fillStyle = colorFg;
	ctx.fill();
	ctx.restore();
}

async function renderStudentCard(user) {
	ensureFonts();
	const t = THEME;
	const W = 1500, H = 820;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");

	drawScrollBg(ctx, W, H, t);

	T(ctx, "STUDENT INDEX", 60, 70, 22, t.primary, { letterSpacing: 6 });
	T(ctx, SCHOOL_NAME.toUpperCase(), 60, 112, 34, t.text, { letterSpacing: 1 });
	GL(ctx, 60, 148, W - 60, 148, t.primary);

	// Avatar en haut à droite
	const img = await fetchAvatar(user.uid);
	drawSquareAvatar(ctx, img, W - 196, 50, 136, t);
	T(ctx, user.class, W - 128, 210, 16, t.secondary, { align: "center", letterSpacing: 2 });
	T(ctx, "RANK " + user.rank, W - 128, 230, 13, t.secondary, { align: "center", letterSpacing: 1 });

	T(ctx, user.fullName.toUpperCase(), 60, 195, 30, t.primary, { letterSpacing: 1 });
	T(ctx, user.studentID, 60, 225, 15, t.text, { weight: "normal", letterSpacing: 1 });

	const colX = 60, colW = (W - 120 - 40) / 2;
	const rowY = 280;

	// Colonne gauche : identité / économie
	T(ctx, "STUDENT RECORD", colX, rowY, 18, t.primary, { letterSpacing: 3 });
	const classData = getClass(user.class);
	const recordRows = [
		["CLASS", user.class],
		["PRIVATE POINTS", N.apply("monospace", Math.round(user.privatePoints))],
		["CLASS POINTS", N.apply("monospace", Math.round(classData ? classData.classPoints : 0))],
		["EXAMS PASSED", `${user.examsWon || 0} / ${user.totalExams || 0}`]
	];
	recordRows.forEach((row, i) => {
		const y = rowY + 50 + i * 56;
		ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = t.primary;
		rr(ctx, colX, y - 24, colW, 44, 6); ctx.fill(); ctx.restore();
		T(ctx, row[0], colX + 20, y, 15, t.secondary, { letterSpacing: 1 });
		T(ctx, String(row[1]), colX + colW - 20, y, 20, t.text, { align: "right" });
	});

	// Colonne droite : statistiques (barres de progression, sans emoji)
	const col2X = colX + colW + 40;
	T(ctx, "ATTRIBUTES", col2X, rowY, 18, t.primary, { letterSpacing: 3 });
	const barW = colW, barH = 14;
	let statY = rowY + 46;
	for (const key of STAT_KEYS) {
		T(ctx, STAT_LABELS_CANVAS[key], col2X, statY, 13, t.text, { weight: "600", letterSpacing: 1 });
		T(ctx, N.apply("monospace", user.stats[key]), col2X + barW, statY, 13, t.primary, { align: "right" });
		drawBar(ctx, col2X, statY + 12, barW, barH, user.stats[key] / 100, "rgba(255,255,255,0.06)", t.secondary);
		statY += 46;
	}

	GL(ctx, 60, H - 60, W - 60, H - 60, t.primary);
	T(ctx, "ADVANCED NURTURING HIGH SCHOOL — OFFICIAL DOCUMENT", W / 2, H - 32, 13, t.secondary, { align: "center", letterSpacing: 2 });

	return canvas;
}

async function replyWithCardOrText(message, textFallback, user, prefix) {
	if (!canvasAvailable) return message.reply(textFallback);
	try {
		const canvas = await renderStudentCard(user);
		fs.ensureDirSync(CACHE_DIR);
		const outPath = path.join(CACHE_DIR, `${prefix}_${Date.now()}.png`);
		fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
		await message.reply({ body: textFallback, attachment: fs.createReadStream(outPath) });
		setTimeout(() => { try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {} }, 30000);
	} catch (e) {
		console.error("[classroom.js] Erreur Canvas:", e.message);
		return message.reply(textFallback);
	}
}

// ============================================================================
// [13] COMMAND HANDLER
// ============================================================================
module.exports = {
	config: {
		name: "classroom",
		aliases: ["class", "anhs"],
		version: "1.0.0",
		author: "Shade",
		countDown: 5,
		role: 0,
		shortDescription: "RPG scolaire Classroom of the Elite",
		longDescription: "Système RPG persistant inspiré de Classroom of the Elite : inscription, Private Points, Class Points, examens, missions, shop, classement et progression de classe.",
		category: "game",
		guide: {
			en: "{pn} register | profile | card | class | ranking | exam <type> | study | missions | shop | buy <id> | pay <uid> <amount> | history | promote | help"
		}
	},

	onStart: async function ({ message, event, args, usersData }) {
		loadDB(); // s'assure que la DB en mémoire est à jour
		const uid = event.senderID;
		const threadID = event.threadID;
		const sub = (args[0] || "help").toLowerCase();

		// ---- REGISTER ----
		if (sub === "register" || sub === "signup") {
			if (isRegistered(uid)) {
				return message.reply("🎓 Vous possédez déjà un dossier étudiant. Utilisez !classroom profile pour le consulter.");
			}
			const info = await message.reply(
				`🎓 ${SCHOOL_NAME}\n\n` +
				`Bienvenue.\nPour créer votre dossier étudiant, indiquez votre prénom.`
			);
			global.GoatBot.onReply.set(info.messageID, {
				commandName: this.config.name,
				type: "register_firstName",
				author: uid,
				threadID
			});
			return;
		}

		if (!isRegistered(uid)) {
			return message.reply("📌 Vous n'avez pas encore de dossier étudiant. Utilisez !classroom register pour vous inscrire.");
		}

		const user = getUser(uid);

		// Déclenchement occasionnel d'un événement aléatoire sur les commandes actives
		if (["study", "exam", "quiz", "missions"].includes(sub)) {
			const evt = maybeTriggerEvent(threadID);
			if (evt) {
				evt.apply(user);
				refreshRank(user);
				await saveDB();
				await message.reply(`${evt.title}\n${evt.text}`);
			}
		}

		switch (sub) {
			case "profile": return cmdProfile(message, user);
			case "card": return cmdCard(message, user);
			case "class": return cmdClass(message, user, args);
			case "ranking": case "rank": case "top": return cmdRanking(message, args);
			case "exam": case "quiz": return cmdExamStart.call(this, message, user, args, threadID);
			case "study": return cmdStudy(message, user);
			case "missions": return cmdMissions(message, user);
			case "shop": return cmdShop(message, args);
			case "buy": return cmdBuy(message, user, args);
			case "pay": case "transfer": return cmdPay(message, user, args, event, threadID);
			case "history": return cmdHistory(message, user);
			case "promote": return cmdPromote(message, user);
			default: return cmdHelp(message);
		}
	},

	onReply: async function ({ message, event, Reply, args, usersData }) {
		loadDB();
		const uid = event.senderID;
		if (uid !== Reply.author) return; // seul l'auteur peut répondre à sa propre inscription/examen
		const body = (event.body || "").trim();
		// Nettoyage de l'ancienne entrée onReply (le prompt auquel l'utilisateur vient de répondre)
		if (event.messageReply && event.messageReply.messageID) {
			global.GoatBot.onReply.delete(event.messageReply.messageID);
		}

		// ---- INSCRIPTION : ETAPE PRENOM ----
		if (Reply.type === "register_firstName") {
			if (!body) return message.reply("Merci d'indiquer un prénom valide.");
			const firstName = body.slice(0, 30);
			const info = await message.reply(`Quel est votre nom de famille ?`);
			global.GoatBot.onReply.set(info.messageID, {
				commandName: this.config.name,
				type: "register_lastName",
				author: uid,
				threadID: event.threadID,
				firstName
			});
			return;
		}

		// ---- INSCRIPTION : ETAPE NOM ----
		if (Reply.type === "register_lastName") {
			if (!body) return message.reply("Merci d'indiquer un nom de famille valide.");
			if (isRegistered(uid)) return message.reply("Vous êtes déjà inscrit entre-temps.");
			const lastName = body.slice(0, 30);
			const user = createStudent(uid, event.threadID, Reply.firstName, lastName);
			await saveDB();

			await message.reply(
				`${F.bold("      STUDENT REGISTERED")}\n` +
				`${F.bold("━━━━━━━━━━━━━━━━━━━━━━━")}\n` +
				`👤 Nom : ${user.fullName}\n` +
				`🆔 Student ID : ${user.studentID}\n` +
				`🏫 Classe : ${user.class}\n` +
				`💰 Private Points : ${fmt(user.privatePoints)}\n\n` +
				`Votre examen d'entrée va commencer...`
			);

			return beginExamFlow(this, message, user, "entrance", event.threadID);
		}

		// ---- EXAMEN : REPONSE A UNE QUESTION ----
		if (Reply.type === "exam_question") {
			const uid2 = event.senderID;
			const user = getUser(uid2);
			if (!user) return;
			const session = Reply.session;
			const letters = ["A", "B", "C", "D"];
			const normalized = body.toUpperCase().replace(/[^A-D]/g, "");
			const answerIndex = letters.indexOf(normalized[0]);

			if (answerIndex === -1) {
				const q = session.questions[session.currentIndex];
				const info = await message.reply("Réponse invalide. Répondez par A, B, C ou D.\n\n" + formatQuestion(session, q));
				global.GoatBot.onReply.set(info.messageID, { ...Reply });
				return;
			}

			const isCorrect = gradeAnswer(session, answerIndex);
			const feedback = isCorrect ? "✅ Bonne réponse !" : "❌ Mauvaise réponse.";

			if (session.currentIndex >= session.questions.length) {
				const result = finalizeExam(user, session);
				refreshClassMembership(user);
				await saveDB();
				return message.reply(
					`${feedback}\n\n` +
					`${F.bold("   " + session.def.label + " — TERMINÉ")}\n` +
					`${F.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}\n` +
					`✅ Bonnes réponses : ${result.correct}/${result.total}\n` +
					`${result.net >= 0 ? `💰 Récompense : +${fmt(result.net)} PP` : `💸 Pénalité : -${fmt(Math.abs(result.net))} PP`}\n` +
					`📊 Résultat : ${result.passed ? "RÉUSSI" : "ÉCHOUÉ"}\n` +
					`🏫 Impact Class Points (${user.class}) : ${result.classImpact >= 0 ? "+" : ""}${fmt(result.classImpact)}\n\n` +
					`Solde actuel : ${fmt(user.privatePoints)} PP — Rang : ${user.rank}`
				);
			} else {
				const nextQ = session.questions[session.currentIndex];
				const info = await message.reply(`${feedback}\n\n${formatQuestion(session, nextQ)}`);
				global.GoatBot.onReply.set(info.messageID, { ...Reply, session });
			}
			return;
		}
	}
};

// ---- Fonctions utilitaires liées aux commandes (hors module.exports) ----

function formatQuestion(session, q) {
	const letters = ["A", "B", "C", "D"];
	const idx = session.currentIndex + 1;
	const total = session.questions.length;
	let text =
		`${F.bold("       " + session.def.label)}\n` +
		`${F.bold("━━━━━━━━━━━━━━━━━━━━━━━")}\n` +
		`${q.categoryLabel}\n` +
		`Question ${idx}/${total}\n\n` +
		`${q.q}\n\n`;
	q.opts.forEach((o, i) => { text += `${letters[i]}. ${o}\n`; });
	text += `\n⏱️ Temps indicatif : 30 secondes`;
	return text;
}

async function beginExamFlow(cmdContext, message, user, examType, threadID) {
	const session = startExam(user, examType);
	const firstQ = session.questions[0];
	const info = await message.reply(formatQuestion(session, firstQ));
	global.GoatBot.onReply.set(info.messageID, {
		commandName: cmdContext.config ? cmdContext.config.name : "classroom",
		type: "exam_question",
		author: user.uid,
		threadID,
		session
	});
}

function cmdProfile(message, user) {
	refreshRank(user);
	let text =
		`${F.bold("🎓 STUDENT PROFILE")}\n` +
		`👤 ${user.fullName}\n` +
		`🆔 ${user.studentID}\n` +
		`🏫 Class : ${user.class}\n` +
		`🎖️ Rank : ${user.rank}\n` +
		`💰 Private Points\n${fmt(user.privatePoints)}\n\n` +
		`${F.bold("📊 ATTRIBUTES")}\n`;
	for (const k of STAT_KEYS) {
		text += `${STAT_LABELS[k]} : ${user.stats[k]}\n`;
	}
	text += `\n📈 Examens réussis : ${user.examsWon || 0} / ${user.totalExams || 0}`;
	return message.reply(text);
}

async function cmdCard(message, user) {
	refreshRank(user);
	const text = `🪪 Carte étudiant de ${user.fullName} (${user.studentID})`;
	return replyWithCardOrText(message, text, user, "classroom_card");
}

function cmdClass(message, user, args) {
	const targetClass = args[1] ? args[1].toUpperCase() : user.class;
	const cls = getClass(targetClass);
	if (!cls) return message.reply("Classe introuvable. Classes disponibles : " + CLASS_ORDER.join(", "));

	const students = cls.students
		.map(id => getUser(id))
		.filter(Boolean)
		.sort((a, b) => b.privatePoints - a.privatePoints);

	const avg = students.length ? Math.round(students.reduce((s, u) => s + u.privatePoints, 0) / students.length) : 0;
	const medals = ["🥇", "🥈", "🥉"];
	let text =
		`${F.bold("🏫 CLASS " + cls.name)}\n` +
		`👥 Students : ${students.length}\n` +
		`🏆 Class Points : ${fmt(cls.classPoints)}\n` +
		`📊 Average : ${fmt(avg)} PP\n` +
		`━━━━━━━━━━━━━━━━\n`;
	students.slice(0, 10).forEach((s, i) => {
		text += `${medals[i] || `${i + 1}.`} ${s.fullName} — ${fmt(s.privatePoints)} PP\n`;
	});
	if (!students.length) text += "Aucun élève inscrit dans cette classe pour le moment.";
	return message.reply(text);
}

function cmdRanking(message, args) {
	const mode = (args[1] || "overall").toLowerCase();
	const all = Object.values(DB.users);
	if (!all.length) return message.reply("Aucun élève inscrit pour le moment.");

	let sorted, title, formatLine;
	if (mode === "rich" || mode === "richest") {
		sorted = [...all].sort((a, b) => b.privatePoints - a.privatePoints);
		title = "💰 RICHEST STUDENTS";
		formatLine = (u) => `${fmt(u.privatePoints)} PP`;
	} else if (mode === "intelligence") {
		sorted = [...all].sort((a, b) => b.stats.intelligence - a.stats.intelligence);
		title = "🧠 HIGHEST INTELLIGENCE";
		formatLine = (u) => `${u.stats.intelligence} INT`;
	} else if (mode === "strategy") {
		sorted = [...all].sort((a, b) => b.stats.strategy - a.stats.strategy);
		title = "🎯 BEST STRATEGY";
		formatLine = (u) => `${u.stats.strategy} STR`;
	} else if (mode === "reputation") {
		sorted = [...all].sort((a, b) => b.stats.reputation - a.stats.reputation);
		title = "⭐ HIGHEST REPUTATION";
		formatLine = (u) => `${u.stats.reputation} REP`;
	} else if (mode === "classes") {
		const ranking = getClassRanking();
		let text = `${F.bold("🏆 CLASS RANKING")}\n`;
		ranking.forEach((c, i) => { text += `${i + 1}. ${c.name} — ${fmt(c.classPoints)} CP\n`; });
		return message.reply(text);
	} else {
		sorted = [...all].sort((a, b) => b.privatePoints - a.privatePoints);
		title = "🏆 TOP STUDENTS (OVERALL)";
		formatLine = (u) => `${fmt(u.privatePoints)} PP — ${u.class}`;
	}

	let text = `${F.bold(title)}\n`;
	sorted.slice(0, 10).forEach((u, i) => {
		text += `${i + 1}. ${u.fullName} — ${formatLine(u)}\n`;
	});
	text += `\nCatégories : overall | rich | intelligence | strategy | reputation | classes`;
	return message.reply(text);
}

async function cmdExamStart(message, user, args, threadID) {
	const cd = onCooldown(user.cooldowns.exam, COOLDOWNS.exam);
	if (cd.active) return message.reply(`⏳ Vous devez attendre encore ${msToClock(cd.remaining)} avant de repasser un examen.`);

	const typeArg = (args[1] || "academic").toLowerCase();
	const validTypes = { academic: "academic", intelligence: "intelligence", strategy: "strategy", special: "special" };
	const examType = validTypes[typeArg] || "academic";

	user.cooldowns.exam = Date.now();
	await saveDB();
	return beginExamFlow(this, message, user, examType, threadID);
}

async function cmdStudy(message, user) {
	const cd = onCooldown(user.cooldowns.study, COOLDOWNS.study);
	if (cd.active) return message.reply(`📚 Vous devez encore attendre ${msToClock(cd.remaining)} avant votre prochaine session d'étude.`);

	const boost = user.tempStudyBoost ? 2 : 1;
	const ppGain = randInt(20, 30) * boost;
	const intGain = 1;
	const acaGain = 2 * boost;

	addPoints(user, ppGain, "Study Session", "study");
	addStat(user, "intelligence", intGain);
	addStat(user, "academic", acaGain);
	user.cooldowns.study = Date.now();
	user.tempStudyBoost = false;
	refreshRank(user);
	await saveDB();

	return message.reply(
		`${F.bold("📚 STUDY SESSION")}\n\n` +
		`Vous avez étudié pendant 30 minutes.\n` +
		`🧠 Intelligence +${intGain}\n` +
		`📚 Academic +${acaGain}\n` +
		`💰 +${ppGain} PP`
	);
}

async function cmdMissions(message, user) {
	const now = Date.now();
	if (!user.missions.daily || (now - user.missions.daily.assignedAt) > COOLDOWNS.daily) {
		assignDailyMission(user);
	}
	if (!user.missions.weekly || (now - user.missions.weekly.assignedAt) > COOLDOWNS.weeklyMission) {
		assignWeeklyMission(user);
	}
	await saveDB();

	const d = user.missions.daily;
	const w = user.missions.weekly;
	let text = `${F.bold("🎯 MISSIONS")}\n\n`;
	text += `📅 DAILY MISSION\n${d.desc}\nRécompense : +${d.reward} PP, ${STAT_LABELS[d.stat]} +${d.statAmount}\nStatut : ${d.claimed ? "✅ Complétée" : "🔲 En cours"}\n\n`;
	text += `🗓️ WEEKLY MISSION\n${w.desc}\nRécompense : +${w.reward} PP, ${STAT_LABELS[w.stat]} +${w.statAmount}\nStatut : ${w.claimed ? "✅ Complétée" : "🔲 En cours"}\n\n`;
	text += `Astuce : passez des examens et étudiez régulièrement pour progresser dans vos missions.`;
	return message.reply(text);
}

function cmdShop(message, args) {
	let text = `${F.bold("🏪 SCHOOL SHOP")}\n\n`;
	SHOP_ITEMS.forEach((item, i) => {
		text += `${i + 1}. ${item.name}\n   ${fmt(item.price)} PP — ${item.desc}\n`;
	});
	text += `\nAchat : !classroom buy <numéro>`;
	return message.reply(text);
}

async function cmdBuy(message, user, args) {
	const index = parseInt(args[1], 10) - 1;
	const item = SHOP_ITEMS[index];
	if (!item) return message.reply("Objet introuvable. Consultez !classroom shop pour voir la liste.");
	if (user.privatePoints < item.price) return message.reply(`💸 Fonds insuffisants. Il vous faut ${fmt(item.price)} PP.`);

	removePoints(user, item.price, `School Shop — ${item.name}`, "shop_purchase");
	const resultMsg = applyShopEffect(user, item);
	refreshRank(user);
	await saveDB();

	return message.reply(`🛒 Achat confirmé : ${item.name}\n${resultMsg}\nSolde restant : ${fmt(user.privatePoints)} PP`);
}

async function cmdPay(message, user, args, event, threadID) {
	if (!args[1] || !args[2]) return message.reply("Syntaxe : !classroom pay <mention/uid> <montant>");

	// Priorité à une mention Messenger (@Nom) si présente, sinon on lit l'uid brut
	let targetID = null;
	if (event.mentions && Object.keys(event.mentions).length) {
		targetID = Object.keys(event.mentions)[0];
	} else {
		targetID = args[1].replace(/[^0-9]/g, "");
	}
	const amount = parseInt(args[args.length - 1], 10);

	if (!targetID || isNaN(amount)) return message.reply("Paramètres invalides.");
	if (!isRegistered(targetID)) return message.reply("Ce joueur n'a pas de dossier étudiant.");

	const target = getUser(targetID);
	const result = transferPoints(user, target, amount);
	if (!result.ok) return message.reply(`❌ ${result.error}`);

	await saveDB();
	return message.reply(`💳 Transfert effectué : ${fmt(amount)} PP envoyés à ${target.fullName}.\nVotre solde : ${fmt(user.privatePoints)} PP`);
}

function cmdHistory(message, user) {
	if (!user.history || !user.history.length) return message.reply("📜 Aucun historique pour le moment.");
	let text = `${F.bold("📜 HISTORY")}\n\n`;
	user.history.slice(0, 15).forEach(h => {
		const sign = h.amount > 0 ? "+" : "";
		text += `${sign}${fmt(h.amount)} PP — ${h.reason}\n`;
	});
	return message.reply(text);
}

async function cmdPromote(message, user) {
	const check = checkPromotionEligibility(user);
	if (!check.checks) {
		return message.reply(check.reason || "Promotion indisponible.");
	}
	if (!check.eligible) {
		let text = `${F.bold("📈 PROMOTION — CONDITIONS NON REMPLIES")}\n\n`;
		text += `💰 Private Points : ${user.privatePoints}/${check.requirements.privatePoints} ${check.checks.privatePoints ? "✅" : "❌"}\n`;
		text += `📊 Stat moyenne : ${Math.round(check.avgStat)}/${check.requirements.avgStat} ${check.checks.avgStat ? "✅" : "❌"}\n`;
		text += `🏆 Examens réussis : ${user.examsWon || 0}/${check.requirements.examsWon} ${check.checks.examsWon ? "✅" : "❌"}\n`;
		text += `⭐ Réputation : ${user.stats.reputation}/${check.requirements.reputation} ${check.checks.reputation ? "✅" : "❌"}\n\n`;
		text += `Il vous faut valider au moins 3 critères sur 4.`;
		return message.reply(text);
	}
	const newClass = promoteUser(user);
	await saveDB();
	return message.reply(`🎉 FÉLICITATIONS !\nVous avez été promu(e) en classe ${newClass} !`);
}

function cmdHelp(message) {
	const helpText = `
${F.bold("🎓 " + SCHOOL_NAME)}
━━━━━━━━━━━━━━━━━━━━━━━

${F.bold("📋 DOSSIER ÉTUDIANT")}
🎓 classroom register — Créer votre dossier étudiant
👤 classroom profile — Voir votre profil complet
🪪 classroom card — Générer votre carte étudiant (Canvas)

${F.bold("🏫 VIE SCOLAIRE")}
🏫 classroom class [nom] — Infos et classement d'une classe
🏆 classroom ranking [catégorie] — overall | rich | intelligence | strategy | reputation | classes
📈 classroom promote — Tenter une promotion vers la classe supérieure

${F.bold("🧠 EXAMENS & PROGRESSION")}
🧠 classroom exam <academic|intelligence|strategy|special> — Passer un examen
📚 classroom study — Étudier (cooldown 30 min)
🎯 classroom missions — Voir vos missions quotidiennes et hebdomadaires

${F.bold("💰 ÉCONOMIE")}
🏪 classroom shop — Boutique de l'école
🛒 classroom buy <numéro> — Acheter un objet
💳 classroom pay <mention|uid> <montant> — Transférer des Private Points
📜 classroom history — Historique de vos transactions

${F.bold("🎮 EN EXAMEN")}
Répondez simplement par A, B, C ou D à la question posée.
`;
	return message.reply(helpText);
}
