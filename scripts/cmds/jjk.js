const fonts = require('../../func/font.js');
const numbers = require('../../func/number.js');

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
	const cv = require("canvas");
	loadImage = cv.loadImage;
	createCanvas = cv.createCanvas;
	registerFont = cv.registerFont;
	canvasAvailable = true;
} catch (e) { console.error("Canvas unavailable:", e.message); }

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

const FB_TOKEN = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

const JUJUTSU_THEMES = {
	six_eyes_azure: { name: "Six Yeux", primary: "#5AC8E8", secondary: "#173B44", bg1: "#050B0C", bg2: "#0C1B1F", text: "#E6F7FB", grid: "#5AC8E8" },
	malevolent_crimson: { name: "Malevolent Shrine", primary: "#C2324B", secondary: "#3C1220", bg1: "#0A0405", bg2: "#170A0D", text: "#F6E2E6", grid: "#C2324B" },
	idle_violet: { name: "Idle Transfiguration", primary: "#9B6FC2", secondary: "#2B1F3D", bg1: "#070508", bg2: "#110D18", text: "#EDE6F5", grid: "#9B6FC2" },
	blood_crimson: { name: "Technique du Sang", primary: "#B8323C", secondary: "#3A1418", bg1: "#0A0405", bg2: "#160A0C", text: "#F3E2E4", grid: "#B8323C" },
	star_plasma_gold: { name: "Vaisseau Stellaire", primary: "#D9A82E", secondary: "#3E2E10", bg1: "#0B0804", bg2: "#170F07", text: "#F7EED8", grid: "#D9A82E" },
	shadow_puppet: { name: "Dix Ombres", primary: "#5E6E7F", secondary: "#232A31", bg1: "#06090A", bg2: "#0E1418", text: "#E4EAEE", grid: "#5E6E7F" },
	cursed_womb_green: { name: "Ventre Maudit", primary: "#5FA05A", secondary: "#1E3020", bg1: "#050805", bg2: "#0D160E", text: "#E4F0E4", grid: "#5FA05A" },
	limitless_indigo: { name: "Illimité", primary: "#4C6FD9", secondary: "#1A2444", bg1: "#050609", bg2: "#0B1020", text: "#E4E9F7", grid: "#4C6FD9" },
	ratio_slate: { name: "Technique du Ratio", primary: "#8B98A4", secondary: "#2A313A", bg1: "#070809", bg2: "#0F1418", text: "#EAEEF2", grid: "#8B98A4" },
	straw_doll_amber: { name: "Poupée de Paille", primary: "#C99A4A", secondary: "#3E3018", bg1: "#0A0805", bg2: "#161006", text: "#F5ECDA", grid: "#C99A4A" },
	umber_shadow: { name: "Chien des Ombres", primary: "#A0714A", secondary: "#352415", bg1: "#080605", bg2: "#140F07", text: "#F0E6D6", grid: "#A0714A" },
	uraume_cyan: { name: "Glace d'Uraume", primary: "#6FC2C9", secondary: "#1F3B3E", bg1: "#050809", bg2: "#0D1A1B", text: "#E4F5F6", grid: "#6FC2C9" },
	jogo_ember: { name: "Braise Volcanique", primary: "#D9682E", secondary: "#3E2010", bg1: "#0B0604", bg2: "#170C07", text: "#F7E4D8", grid: "#D9682E" },
	hanami_jade: { name: "Nature Maudite", primary: "#4FA084", secondary: "#173D30", bg1: "#050807", bg2: "#0D1814", text: "#E2F2EC", grid: "#4FA084" },
	copy_lavender: { name: "Copie Absolue", primary: "#A48FD9", secondary: "#2E2744", bg1: "#070609", bg2: "#120F1B", text: "#EEE9F7", grid: "#A48FD9" }
};

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

function drawDomainBg(ctx, W, H, t) {
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
	const fillW = Math.max(h, w * Math.max(0, Math.min(1, ratio)));
	ctx.save();
	rr(ctx, x, y, fillW, h, h / 2);
	ctx.fillStyle = colorFg;
	ctx.fill();
	ctx.restore();
}

async function fetchAvatar(uid) {
	try {
		const res = await axios.get(
			`https://graph.facebook.com/${uid}/picture?width=400&height=400&access_token=${FB_TOKEN}`,
			{ responseType: "arraybuffer", timeout: 10000 }
		);
		return await loadImage(Buffer.from(res.data));
	} catch (_) { return null; }
}

function pickTheme() {
	const keys = Object.keys(JUJUTSU_THEMES);
	return JUJUTSU_THEMES[keys[Math.floor(Math.random() * keys.length)]];
}

async function renderAndAttach(message, text, canvasPromise, prefix) {
	if (!canvasAvailable) return message.reply(text);
	try {
		const canvas = await canvasPromise;
		const cacheDir = path.join(__dirname, "cache");
		if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
		const outPath = path.join(cacheDir, `${prefix}_${Date.now()}.png`);
		fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
		await message.reply({ body: text, attachment: fs.createReadStream(outPath) });
		setTimeout(() => { try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {} }, 30000);
	} catch (e) {
		console.error(`${prefix} canvas error:`, e);
		return message.reply(text);
	}
}

// ============================================================
// PERSONNAGES — 24 sorciers et fléaux de Jujutsu Kaisen
// ============================================================
const CHARACTER_LINES = [
	{
		id: 1, key: "yuji", clan: "🩸 Vaisseau de Sukuna",
		emoji: "🩸",
		stages: [
			{ minLevel: 1, name: "Yuji Itadori (Lycéen)", power: 46, basic: "Coup Renforce", ultimate: "Explosion de Chakra Noir" },
			{ minLevel: 15, name: "Yuji Itadori (Flash Noir)", power: 64, basic: "Flash Noir", ultimate: "Rafale de Flashs Noirs" },
			{ minLevel: 30, name: "Yuji Itadori (Doigts Absorbes)", power: 84, basic: "Frappe Amplifiee", ultimate: "Extension : Domaine Malveillant Partiel" },
			{ minLevel: 50, name: "Yuji Itadori (Fusion avec Sukuna)", power: 104, basic: "Frappe du Roi des Fleaux", ultimate: "Extension de Domaine : Sanctuaire Malveillant" }
		]
	},
	{
		id: 2, key: "megumi", clan: "🐺 Dix Ombres",
		emoji: "🐺",
		stages: [
			{ minLevel: 1, name: "Megumi Fushiguro (Lycéen)", power: 44, basic: "Divination : Chien a Deux Tetes", ultimate: "Divination : Serpent Toxique" },
			{ minLevel: 15, name: "Megumi Fushiguro (Maitre des Ombres)", power: 60, basic: "Meute de Chiens Fantomes", ultimate: "Nue Foudroyante" },
			{ minLevel: 30, name: "Megumi Fushiguro (Chimere Divine)", power: 78, basic: "Divination : Bete a Huit Ailes", ultimate: "Chimere Divine : Attaque Combinee" },
			{ minLevel: 50, name: "Megumi Fushiguro (Roi des Dix Ombres)", power: 98, basic: "Frappe de la Meute Complete", ultimate: "Extension de Domaine : Chimatsuri" }
		]
	},
	{
		id: 3, key: "nobara", clan: "🔨 Poupee de Paille",
		emoji: "🔨",
		stages: [
			{ minLevel: 1, name: "Nobara Kugisaki (Lycéenne)", power: 42, basic: "Clou Vibrant", ultimate: "Frappe Resonnante" },
			{ minLevel: 15, name: "Nobara Kugisaki (Marteau Affute)", power: 58, basic: "Clou Renforce", ultimate: "Vibration Explosive" },
			{ minLevel: 30, name: "Nobara Kugisaki (Poupee Complete)", power: 76, basic: "Chaine de Clous", ultimate: "Resonance : Extraction Douloureuse" },
			{ minLevel: 50, name: "Nobara Kugisaki (Ame Vengeresse)", power: 96, basic: "Frappe de Cheveux Maudits", ultimate: "Deluge de Clous Vibrants" }
		]
	},
	{
		id: 4, key: "gojo", clan: "🔵 Six Yeux",
		emoji: "🔵",
		stages: [
			{ minLevel: 1, name: "Satoru Gojo (Six Yeux)", power: 56, basic: "Bleu (Attraction)", ultimate: "Rouge (Repulsion)" },
			{ minLevel: 18, name: "Satoru Gojo (Illimite)", power: 76, basic: "Espace Illimite", ultimate: "Vide Cramoisi" },
			{ minLevel: 36, name: "Satoru Gojo (Sorcier le Plus Fort)", power: 96, basic: "Frappe Illimitee", ultimate: "Extension de Domaine : Prison Immuable" },
			{ minLevel: 56, name: "Satoru Gojo (Six Yeux Reveilles)", power: 118, basic: "Frappe Absolue", ultimate: "Effacement du Monde" }
		]
	},
	{
		id: 5, key: "geto", clan: "👥 Manipulation d'Esprits",
		emoji: "👥",
		stages: [
			{ minLevel: 1, name: "Suguru Geto (Sorcier)", power: 50, basic: "Invocation d'Esprit Maudit", ultimate: "Nue de Fleaux" },
			{ minLevel: 18, name: "Suguru Geto (Collectionneur d'Esprits)", power: 68, basic: "Danse des Esprits", ultimate: "Deluge d'Esprits Maudits" },
			{ minLevel: 36, name: "Suguru Geto (Corps Emprunte)", power: 86, basic: "Frappe Spectrale", ultimate: "Extension de Domaine : Chambre Uzumaki" },
			{ minLevel: 54, name: "Suguru Geto (Reincarne)", power: 106, basic: "Frappe des Mille Esprits", ultimate: "Armee des Fleaux Absolue" }
		]
	},
	{
		id: 6, key: "sukuna", clan: "👹 Roi des Fleaux",
		emoji: "👹",
		stages: [
			{ minLevel: 1, name: "Sukuna (Doigt Scelle)", power: 58, basic: "Fente", ultimate: "Demembrement" },
			{ minLevel: 20, name: "Sukuna (Corps Reforme)", power: 78, basic: "Feu Divergent", ultimate: "Fleau Dechaine" },
			{ minLevel: 40, name: "Sukuna (Vaisseau Complet)", power: 98, basic: "Frappe des Huit Bras", ultimate: "Extension de Domaine : Sanctuaire Malveillant" },
			{ minLevel: 58, name: "Sukuna (Roi des Fleaux Supreme)", power: 122, basic: "Frappe de la Destruction", ultimate: "Feu Divergent Absolu" }
		]
	},
	{
		id: 7, key: "nanami", clan: "💼 Technique du Ratio",
		emoji: "💼",
		stages: [
			{ minLevel: 1, name: "Kento Nanami (Sorcier de Grade 1)", power: 48, basic: "Coup de Regle", ultimate: "Ratio 7:3" },
			{ minLevel: 16, name: "Kento Nanami (Heures Supplementaires)", power: 64, basic: "Frappe Mesuree", ultimate: "Overtime : Frappe Fatale" },
			{ minLevel: 32, name: "Kento Nanami (Sorcier Aguerri)", power: 82, basic: "Marteau Calcule", ultimate: "Ratio Absolu 7:3" },
			{ minLevel: 50, name: "Kento Nanami (Le Salarie Legendaire)", power: 100, basic: "Frappe de la Regle d'Or", ultimate: "Point Faible Garanti" }
		]
	},
	{
		id: 8, key: "maki", clan: "⚔️ Restriction Celeste",
		emoji: "⚔️",
		stages: [
			{ minLevel: 1, name: "Maki Zenin (Sans Energie Maudite)", power: 40, basic: "Frappe au Sabre", ultimate: "Tranche Rapide" },
			{ minLevel: 14, name: "Maki Zenin (Restriction Celeste)", power: 56, basic: "Danse des Lames", ultimate: "Tempete de Sabres" },
			{ minLevel: 30, name: "Maki Zenin (Corps Parfait)", power: 76, basic: "Frappe Surhumaine", ultimate: "Massacre au Sabre Sacre" },
			{ minLevel: 48, name: "Maki Zenin (Chef du Clan Zenin)", power: 96, basic: "Frappe de la Lame Divine", ultimate: "Extermination du Clan" }
		]
	},
	{
		id: 9, key: "inumaki", clan: "🗣️ Discours Maudit",
		emoji: "🗣️",
		stages: [
			{ minLevel: 1, name: "Toge Inumaki (Sorcier Bavard)", power: 40, basic: "Meurs", ultimate: "Explose" },
			{ minLevel: 14, name: "Toge Inumaki (Onigiri)", power: 54, basic: "Tombe", ultimate: "Immobilise-toi" },
			{ minLevel: 30, name: "Toge Inumaki (Voix Maudite)", power: 72, basic: "Recule", ultimate: "Detruis-toi Toi Meme" },
			{ minLevel: 48, name: "Toge Inumaki (Clan Inumaki Complet)", power: 90, basic: "Frappe Vocale", ultimate: "Ordre Absolu" }
		]
	},
	{
		id: 10, key: "panda", clan: "🐼 Triple Personnalite",
		emoji: "🐼",
		stages: [
			{ minLevel: 1, name: "Panda (Objet Maudit)", power: 44, basic: "Poing de Panda", ultimate: "Transformation Gorille" },
			{ minLevel: 14, name: "Panda (Double Personnalite)", power: 58, basic: "Frappe de Gorille", ultimate: "Explosion de la Moelle" },
			{ minLevel: 30, name: "Panda (Triple Corps)", power: 76, basic: "Frappe Combinee", ultimate: "Rugissement Destructeur" },
			{ minLevel: 48, name: "Panda (Ame Independante)", power: 94, basic: "Frappe des Trois Ames", ultimate: "Fusion des Trois Corps" }
		]
	},
	{
		id: 11, key: "todo", clan: "🎵 Boogie Woogie",
		emoji: "🎵",
		stages: [
			{ minLevel: 1, name: "Aoi Todo (Sorcier de Kyoto)", power: 48, basic: "Coup de Poing Puissant", ultimate: "Boogie Woogie : Echange" },
			{ minLevel: 16, name: "Aoi Todo (Meilleur Ami)", power: 64, basic: "Frappe Coordonnee", ultimate: "Boogie Woogie : Frappe Surprise" },
			{ minLevel: 32, name: "Aoi Todo (Puissance Brute)", power: 82, basic: "Uppercut Devastateur", ultimate: "Boogie Woogie : Combo Fatal" },
			{ minLevel: 50, name: "Aoi Todo (Le Plus Fort de Kyoto)", power: 100, basic: "Frappe Ultime", ultimate: "Boogie Woogie : Reversal Parfait" }
		]
	},
	{
		id: 12, key: "mahito", clan: "🌀 Transfiguration Idiote",
		emoji: "🌀",
		stages: [
			{ minLevel: 1, name: "Mahito (Esprit Maudit)", power: 46, basic: "Poing Transfigurant", ultimate: "Metamorphose de l'Ame" },
			{ minLevel: 16, name: "Mahito (Corps Modifie)", power: 62, basic: "Distorsion de Chair", ultimate: "Renaissance Difforme" },
			{ minLevel: 32, name: "Mahito (Forme Transcendante)", power: 80, basic: "Vague de Distorsion", ultimate: "Extension de Domaine : Naissance Difforme" },
			{ minLevel: 50, name: "Mahito (Ame Absolue)", power: 98, basic: "Frappe de l'Ame Nue", ultimate: "Transfiguration Totale" }
		]
	},
	{
		id: 13, key: "jogo", clan: "🌋 Fleau Volcanique",
		emoji: "🌋",
		stages: [
			{ minLevel: 1, name: "Jogo (Fleau du Feu)", power: 48, basic: "Boule de Lave", ultimate: "Eruption Localisee" },
			{ minLevel: 16, name: "Jogo (Maitre des Volcans)", power: 64, basic: "Pluie de Cendres", ultimate: "Eruption Massive" },
			{ minLevel: 32, name: "Jogo (Corps de Magma)", power: 82, basic: "Coulee de Lave", ultimate: "Extension de Domaine : Corridor de la Coulee de Lave" },
			{ minLevel: 50, name: "Jogo (Fleau Special Grade)", power: 100, basic: "Frappe Volcanique", ultimate: "Cataclysme Igne" }
		]
	},
	{
		id: 14, key: "hanami", clan: "🌿 Fleau Naturel",
		emoji: "🌿",
		stages: [
			{ minLevel: 1, name: "Hanami (Fleau de la Nature)", power: 46, basic: "Racines Assassines", ultimate: "Foret Devorante" },
			{ minLevel: 16, name: "Hanami (Corps Vegetal)", power: 62, basic: "Liane Etrangleuse", ultimate: "Explosion Botanique" },
			{ minLevel: 32, name: "Hanami (Fusion Arboree)", power: 80, basic: "Armure d'Ecorce", ultimate: "Extension de Domaine : Jardin Interdit" },
			{ minLevel: 50, name: "Hanami (Gardien de la Nature)", power: 98, basic: "Frappe Racinaire", ultimate: "Cataclysme Vegetal" }
		]
	},
	{
		id: 15, key: "choso", clan: "🩸 Manipulation du Sang",
		emoji: "🩸",
		stages: [
			{ minLevel: 1, name: "Choso (Frere de Sang)", power: 46, basic: "Fleche de Sang", ultimate: "Lance de Sang" },
			{ minLevel: 16, name: "Choso (Sang Durci)", power: 62, basic: "Epee de Sang", ultimate: "Piercing Blood : Ame de Fer" },
			{ minLevel: 32, name: "Choso (Grand Frere)", power: 80, basic: "Deluge de Sang", ultimate: "Extension de Domaine : Femme Endeuillee" },
			{ minLevel: 50, name: "Choso (Protecteur Absolu)", power: 98, basic: "Frappe Sanguine", ultimate: "Cataclysme Ecarlate" }
		]
	},
	{
		id: 16, key: "yuta", clan: "🎭 Copie Absolue",
		emoji: "🎭",
		stages: [
			{ minLevel: 1, name: "Yuta Okkotsu (Sorcier Special)", power: 50, basic: "Frappe Copiee", ultimate: "Technique Empruntee" },
			{ minLevel: 18, name: "Yuta Okkotsu (Lie a Rika)", power: 68, basic: "Frappe de Rika", ultimate: "Invocation : Rika" },
			{ minLevel: 36, name: "Yuta Okkotsu (Maitre des Copies)", power: 88, basic: "Combo Multi-Techniques", ultimate: "Extension de Domaine : Prison Immuable Copiee" },
			{ minLevel: 54, name: "Yuta Okkotsu (Nouveau Sorcier le Plus Fort)", power: 108, basic: "Frappe Ultime Copiee", ultimate: "Fusion avec Rika : Devastation Totale" }
		]
	},
	{
		id: 17, key: "rika", clan: "👻 Esprit Maudit Special Grade",
		emoji: "👻",
		stages: [
			{ minLevel: 1, name: "Rika Orimoto (Ame Attachee)", power: 44, basic: "Griffe Spectrale", ultimate: "Rage de l'Ame" },
			{ minLevel: 16, name: "Rika Orimoto (Forme Partielle)", power: 60, basic: "Frappe Fantomatique", ultimate: "Deluge Spectral" },
			{ minLevel: 32, name: "Rika Orimoto (Reine des Fleaux)", power: 78, basic: "Griffe Devastatrice", ultimate: "Explosion d'Ame Pure" },
			{ minLevel: 50, name: "Rika Orimoto (Amour Eternel)", power: 96, basic: "Frappe de l'Amour Maudit", ultimate: "Destruction Totale par Amour" }
		]
	},
	{
		id: 18, key: "kenjaku", clan: "🧠 Transplantation Cerebrale",
		emoji: "🧠",
		stages: [
			{ minLevel: 1, name: "Kenjaku (Corps Emprunte)", power: 50, basic: "Frappe Chirurgicale", ultimate: "Manipulation Cellulaire" },
			{ minLevel: 18, name: "Kenjaku (Sorcier Millenaire)", power: 68, basic: "Danse des Sceaux", ultimate: "Fusion Cellulaire" },
			{ minLevel: 36, name: "Kenjaku (Architecte du Chaos)", power: 86, basic: "Frappe du Plan Ancien", ultimate: "Reveil de Sukuna" },
			{ minLevel: 54, name: "Kenjaku (Le Cerveau Supreme)", power: 106, basic: "Frappe de la Manipulation", ultimate: "Plan Millenaire Accompli" }
		]
	},
	{
		id: 19, key: "yuki", clan: "⭐ Rage Stellaire",
		emoji: "⭐",
		stages: [
			{ minLevel: 1, name: "Yuki Tsukumo (Sorcier Special)", power: 52, basic: "Frappe Stellaire", ultimate: "Onde de Rage" },
			{ minLevel: 20, name: "Yuki Tsukumo (Constellation Star Rage)", power: 70, basic: "Frappe Cosmique", ultimate: "Explosion d'Etoile" },
			{ minLevel: 38, name: "Yuki Tsukumo (Manipulatrice de Gravite)", power: 90, basic: "Ecrasement Gravitationnel", ultimate: "Extension de Domaine : Star Rage" },
			{ minLevel: 56, name: "Yuki Tsukumo (Sorciere Cosmique)", power: 110, basic: "Frappe de l'Univers", ultimate: "Effondrement Stellaire" }
		]
	},
	{
		id: 20, key: "uraume", clan: "❄️ Manipulation de la Glace",
		emoji: "❄️",
		stages: [
			{ minLevel: 1, name: "Uraume (Servante de Sukuna)", power: 46, basic: "Lame de Glace", ultimate: "Tempete de Neige" },
			{ minLevel: 16, name: "Uraume (Cuisiniere Maudite)", power: 62, basic: "Pique de Glace", ultimate: "Blizzard Absolu" },
			{ minLevel: 32, name: "Uraume (Gardienne Loyale)", power: 80, basic: "Frappe Glaciale", ultimate: "Ere Glaciaire Instantanee" },
			{ minLevel: 50, name: "Uraume (Fidele Jusqu'a la Mort)", power: 98, basic: "Frappe de Givre Absolu", ultimate: "Cataclysme de Glace" }
		]
	},
	{
		id: 21, key: "kamo", clan: "🩸 Sang du Clan Kamo",
		emoji: "🩸",
		stages: [
			{ minLevel: 1, name: "Noritoshi Kamo (Heritier du Clan)", power: 44, basic: "Fleche de Sang Kamo", ultimate: "Lance Sanguine" },
			{ minLevel: 14, name: "Noritoshi Kamo (Sang Optimise)", power: 58, basic: "Epee de Sang Pur", ultimate: "Deluge de Sang du Clan" },
			{ minLevel: 30, name: "Noritoshi Kamo (Chef du Clan)", power: 76, basic: "Frappe du Sang Ancestral", ultimate: "Explosion Hemoglobine" },
			{ minLevel: 48, name: "Noritoshi Kamo (Sang Legendaire)", power: 94, basic: "Frappe Ultime du Sang", ultimate: "Cataclysme Ecarlate du Clan" }
		]
	},
	{
		id: 22, key: "meimei", clan: "🐦‍⬛ Manipulation de Corbeaux",
		emoji: "🐦‍⬛",
		stages: [
			{ minLevel: 1, name: "Mei Mei (Mercenaire)", power: 46, basic: "Bec Tranchant", ultimate: "Nue de Corbeaux" },
			{ minLevel: 16, name: "Mei Mei (Espionne Aerienne)", power: 62, basic: "Vol en Piquet", ultimate: "Deluge de Corbeaux" },
			{ minLevel: 32, name: "Mei Mei (Contrat Mercenaire)", power: 80, basic: "Frappe Aerienne", ultimate: "Cataclysme Aviaire" },
			{ minLevel: 50, name: "Mei Mei (La Sorciere Interessee)", power: 98, basic: "Frappe du Corbeau Divin", ultimate: "Empire des Corbeaux" }
		]
	},
	{
		id: 23, key: "higuruma", clan: "⚖️ Verdict du Jugement",
		emoji: "⚖️",
		stages: [
			{ minLevel: 1, name: "Hiromi Higuruma (Ancien Juge)", power: 48, basic: "Marteau du Jugement", ultimate: "Sentence Immediate" },
			{ minLevel: 18, name: "Hiromi Higuruma (Avocat de la Loi)", power: 66, basic: "Frappe du Verdict", ultimate: "Peine Capitale" },
			{ minLevel: 36, name: "Hiromi Higuruma (Cour Supreme)", power: 84, basic: "Frappe Legale", ultimate: "Extension de Domaine : Salle du Tribunal" },
			{ minLevel: 54, name: "Hiromi Higuruma (Justice Absolue)", power: 104, basic: "Frappe de la Loi Ultime", ultimate: "Execution du Verdict Final" }
		]
	},
	{
		id: 24, key: "naoya", clan: "🌀 Projection Sorcery",
		emoji: "🌀",
		stages: [
			{ minLevel: 1, name: "Naoya Zenin (Heritier Zenin)", power: 46, basic: "Frappe Teleportee", ultimate: "Assaut Instantane" },
			{ minLevel: 16, name: "Naoya Zenin (Vitesse de Projection)", power: 62, basic: "Frappe Multiple Instantanee", ultimate: "Rafale de Teleportations" },
			{ minLevel: 32, name: "Naoya Zenin (Arrogance du Clan)", power: 80, basic: "Combo Teleporte", ultimate: "Assaut Foudroyant Absolu" },
			{ minLevel: 50, name: "Naoya Zenin (Le Genie Dechu)", power: 98, basic: "Frappe de l'Orgueil", ultimate: "Massacre Instantane" }
		]
	}
];

// ============================================================
// QUETES
// ============================================================
const QUESTS = [
	{ id: 1, name: "Exorcisme d'un Esprit Mineur", minLevel: 1, enemyName: "Esprit Maudit de Grade 4", enemyPower: 30, xp: 40, gold: 150 },
	{ id: 2, name: "Traque a l'Ecole de Kyoto", minLevel: 5, enemyName: "Esprit Maudit de Grade 3", enemyPower: 42, xp: 70, gold: 300 },
	{ id: 3, name: "Incident au Tunnel Abandonne", minLevel: 10, enemyName: "Esprit Maudit de Grade 2", enemyPower: 55, xp: 110, gold: 500 },
	{ id: 4, name: "Mission de Nettoyage a Sendai", minLevel: 16, enemyName: "Esprit Maudit de Grade 1", enemyPower: 68, xp: 160, gold: 800 },
	{ id: 5, name: "Infiltration des Sorciers Maudits", minLevel: 24, enemyName: "Disciple de Geto", enemyPower: 82, xp: 230, gold: 1300 },
	{ id: 6, name: "Fleau Special Grade en Furie", minLevel: 34, enemyName: "Esprit Maudit Special Grade", enemyPower: 98, xp: 320, gold: 2000 },
	{ id: 7, name: "L'Ombre d'un Sorcier Legendaire", minLevel: 45, enemyName: "Spectre du Sorcier le Plus Fort", enemyPower: 115, xp: 420, gold: 3000 },
	{ id: 8, name: "Le Reveil d'un Roi des Fleaux", minLevel: 55, enemyName: "Fragment de Sukuna", enemyPower: 135, xp: 600, gold: 5000 },
	{ id: 9, name: "Le Combat des Sorciers Legendaires", minLevel: 40, enemyName: "Suguru Geto", enemyPower: 110, xp: 500, gold: 3500 },
	{ id: 10, name: "La Defense de Shibuya", minLevel: 50, enemyName: "Mahito", enemyPower: 125, xp: 550, gold: 4500 },
	{ id: 11, name: "La Menace de Jogo", minLevel: 30, enemyName: "Jogo", enemyPower: 100, xp: 400, gold: 2800 },
	{ id: 12, name: "Le Retour de Sukuna", minLevel: 48, enemyName: "Sukuna", enemyPower: 130, xp: 580, gold: 4800 },
	{ id: 13, name: "L'Incident de Shibuya Final", minLevel: 56, enemyName: "Kenjaku", enemyPower: 140, xp: 650, gold: 5500 },
	{ id: 14, name: "Le Culling Game Final", minLevel: 60, enemyName: "Sorcier de la Death Painting", enemyPower: 150, xp: 800, gold: 8000 }
];

const MAX_LEVEL = 60;
const TRAIN_COOLDOWN_MS = 15 * 60 * 1000;

function xpForLevel(level) {
	return Math.round(80 * Math.pow(level, 1.35));
}

function getLine(characterId) {
	return CHARACTER_LINES.find(l => l.id === characterId) || null;
}

function getStage(line, level) {
	let stage = line.stages[0];
	for (const s of line.stages) {
		if (level >= s.minLevel) stage = s;
	}
	return stage;
}

function computeStats(line, level) {
	const stage = getStage(line, level);
	const bonus = Math.max(0, level - stage.minLevel) * 0.6;
	return {
		stageName: stage.name,
		power: Math.round(stage.power + bonus),
		basic: stage.basic,
		ultimate: stage.ultimate
	};
}

function addXp(pdata, amount) {
	const line = getLine(pdata.characterId);
	const stageBefore = line ? getStage(line, pdata.level).name : null;
	let leveledUp = false;
	pdata.xp += amount;
	while (pdata.level < MAX_LEVEL && pdata.xp >= xpForLevel(pdata.level)) {
		pdata.xp -= xpForLevel(pdata.level);
		pdata.level += 1;
		leveledUp = true;
	}
	const stageAfter = line ? getStage(line, pdata.level).name : null;
	return { leveledUp, evolved: stageBefore !== stageAfter, newLevel: pdata.level, newStageName: stageAfter };
}

function randomBetween(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDamage(kind, power) {
	const ranges = { basic: [8, 15], special: [15, 25], ultimate: [28, 42] };
	const [mn, mx] = ranges[kind];
	const scale = 0.6 + (power / 100);
	return Math.max(1, Math.round(randomBetween(mn, mx) * scale));
}

function healthColor(hp) {
	if (hp >= 70) return "🟩";
	if (hp >= 35) return "🟨";
	if (hp > 0) return "🟥";
	return "💀";
}

const battles = {};
const userBattle = {};
const pendingDuels = {};

function cleanupBattle(battleId) {
	for (const uid of Object.keys(userBattle)) {
		if (userBattle[uid] === battleId) delete userBattle[uid];
	}
	delete battles[battleId];
}

function resolveTurn(battle, key, letter) {
	const other = key === "p1" ? "p2" : "p1";
	const power = battle.power[key];
	const basicTech = battle.basic[key];
	const ultTech = battle.ultimate[key];

	let damage = 0, tech = "Frappe Basique", missed = false, isCharge = false, isDefend = false, chargeGain = 0;

	switch (letter) {
		case 'a':
			damage = rollDamage('basic', power);
			tech = "Frappe Basique";
			break;
		case 'b':
			if (battle.chakra[key] < 20) { missed = true; tech = basicTech; }
			else { damage = rollDamage('special', power); battle.chakra[key] -= 20; tech = basicTech; }
			break;
		case 'x':
			if (battle.chakra[key] < 45) { missed = true; tech = ultTech; }
			else {
				battle.chakra[key] -= 45;
				if (Math.random() < 0.25) { missed = true; tech = ultTech + " (echouee)"; }
				else { damage = rollDamage('ultimate', power); tech = ultTech; }
			}
			break;
		case 'c':
			chargeGain = 30;
			battle.chakra[key] = Math.min(100, battle.chakra[key] + chargeGain);
			isCharge = true;
			break;
		case 'd':
			battle.defending = key;
			isDefend = true;
			break;
		default:
			return null;
	}

	let blocked = false;
	if (!isCharge && !isDefend && !missed) {
		if (battle.defending === other) {
			damage = Math.floor(damage * 0.45);
			blocked = true;
			battle.defending = null;
		}
		battle.hp[other] = Math.max(0, battle.hp[other] - damage);
	}

	if (letter !== 'c') battle.chakra[key] = Math.min(100, battle.chakra[key] + 5);

	return { key, other, letter, tech, damage, missed, isCharge, isDefend, blocked, chargeGain };
}

function aiChoose(battle) {
	const chakra = battle.chakra.p2;
	const hpSelf = battle.hp.p2;
	const hpEnemy = battle.hp.p1;
	if (chakra >= 45 && (hpEnemy <= 40 || Math.random() < 0.3)) return 'x';
	if (chakra >= 20 && Math.random() < 0.5) return 'b';
	if (hpSelf <= 30 && Math.random() < 0.35) return 'd';
	if (chakra < 20 && Math.random() < 0.4) return 'c';
	return 'a';
}

function formatAction(r, battle) {
	const attackerName = battle.name[r.key];
	const defenderName = battle.name[r.other];
	if (r.isCharge) {
		return `🔵 ${attackerName} accumule de l'energie maudite (+${r.chargeGain}%).\n`;
	}
	if (r.isDefend) {
		return `🛡️ ${attackerName} se met en position defensive.\n`;
	}
	if (r.missed) {
		return `⚡ ${attackerName} tente ${r.tech}... ❌ Echec !\n`;
	}
	const blockedTxt = r.blocked ? " (bloquee)" : "";
	return `⚔️ ${attackerName} utilise ${r.tech}${blockedTxt}\n💥 Inflige ${r.damage}% de degats a ${defenderName} !\n`;
}

function statusBars(battle) {
	let msg = `━━━━━━━━━━━━━━\n`;
	msg += `${healthColor(battle.hp.p1)} ${battle.name.p1} — HP ${battle.hp.p1}% | Energie ${battle.chakra.p1}%\n`;
	msg += `${healthColor(battle.hp.p2)} ${battle.name.p2} — HP ${battle.hp.p2}% | Energie ${battle.chakra.p2}%\n`;
	msg += `━━━━━━━━━━━━━━\n`;
	return msg;
}

const COMBAT_HELP = `🎮 Commandes disponibles :\n» a — Attaque basique\n» b — Technique maudite (-20 energie)\n» x — Extension de Domaine / Technique ultime (-45 energie)\n» c — Charger l'energie maudite (+30%)\n» d — Defense (reduit les degats)\n» fin — Abandonner le combat`;

module.exports = {
	config: {
		name: "jjk",
		aliases: ["jujutsu", "sorcier"],
		version: "1.0",
		author: "Shade",
		countDown: 0,
		role: 0,
		category: "game",
		description: {
			en: "Jujutsu Kaisen RPG: choose a sorcerer, level it up, complete missions and duel other players"
		},
		guide: {
			en: "{pn} help to see all commands"
		}
	},

	langs: {
		en: {
			help: "Jujutsu Kaisen RPG commands list"
		}
	},

	onLoad: function () {
		ensureFonts();
	},

	onStart: async function ({ message, args, event, usersData, api }) {
		const { senderID, threadID } = event;
		const command = (args[0] || "").toLowerCase();

		let user = await usersData.get(senderID);
		if (!user) user = { money: 0, exp: 0, data: {} };
		if (!user.data) user.data = {};
		if (!user.data.jjk) {
			user.data.jjk = {
				characterId: null,
				level: 1,
				xp: 0,
				wins: 0,
				losses: 0,
				lastTrain: null,
				lastQuestId: null,
				createdAt: Date.now(),
				rank: "4ème Grade",
				completedQuests: [],
				items: []
			};
		}
		const pdata = user.data.jjk;

		const save = async () => { await usersData.set(senderID, user); };

		switch (command) {
			case "help":
			case undefined:
			case "":
				return this.showHelp(message, fonts);

			case "choose":
			case "select":
				return this.chooseCharacter(message, args, pdata, fonts, save, usersData, senderID);

			case "profile":
			case "card":
				return this.showProfile(message, pdata, fonts, usersData, senderID);

			case "roster":
			case "characters":
			case "list":
				return this.showRoster(message, fonts);

			case "quest":
			case "mission":
				return this.handleQuest(message, args, pdata, fonts, save, senderID, threadID);

			case "train":
			case "entrainement":
				return this.handleTrain(message, pdata, fonts, save, user);

			case "duel":
			case "combat":
				return this.handleDuelChallenge(message, event, pdata, fonts, usersData, senderID, threadID, api);

			case "leaderboard":
			case "classement":
				return this.showLeaderboard(message, fonts, usersData);

			case "rank":
			case "rang":
				return this.showRankInfo(message, pdata, fonts, save);

			case "inventory":
			case "items":
			case "inventaire":
				return this.showInventory(message, pdata, fonts);

			case "stats":
			case "statistiques":
				return this.showDetailedStats(message, pdata, fonts, usersData, senderID);

			case "reset":
				return this.resetCharacter(message, args, pdata, fonts, save);

			case "fin":
			case "quit":
			case "abandon":
			case "cancel": {
				const battleId = userBattle[senderID];
				if (battleId) {
					cleanupBattle(battleId);
					return message.reply(fonts.bold("Le combat a ete abandonne."));
				}
				if (pendingDuels[threadID] && (pendingDuels[threadID].challenger === senderID || pendingDuels[threadID].target === senderID)) {
					delete pendingDuels[threadID];
					return message.reply(fonts.bold("Le defi de duel a ete annule."));
				}
				return message.reply(fonts.bold("Vous n'avez aucun combat ou defi en cours."));
			}

			default:
				return this.showHelp(message, fonts);
		}
	},

	showHelp: function (message, fonts) {
		const helpText = `
${fonts.bold("🌀 JUJUTSU KAISEN RPG — MENU")}
━━━━━━━━━━━━━━━━━━━━━━━

${fonts.bold("🎯 PERSONNAGE")} ${fonts.bold("━━━━━━━━━")}
🎭 jjk choose — Choisir votre sorcier (definitif, il evolue ensuite)
📋 jjk profile — Voir votre carte de sorcier
📜 jjk roster — Voir la liste des personnages disponibles
🔄 jjk reset — Reinitialiser votre personnage (perte de progression)

${fonts.bold("⚡ PROGRESSION")} ${fonts.bold("━━━━━━━━━")}
🏋️ jjk train — Vous entrainer pour gagner de l'XP et de l'argent
🎯 jjk quest — Voir les missions disponibles
🎯 jjk quest <numero> — Lancer un combat de mission contre un fleau
🏅 jjk rank — Voir votre grade et progression

${fonts.bold("⚔️ DUEL ENTRE JOUEURS")} ${fonts.bold("━━━━━━━━━")}
🤺 jjk duel @utilisateur — Defier un autre joueur en duel
Repondez "accepter" ou "refuser" au defi recu

${fonts.bold("🎮 EN COMBAT")} ${fonts.bold("━━━━━━━━━")}
${COMBAT_HELP}

${fonts.bold("📊 AUTRE")} ${fonts.bold("━━━━━━━━━")}
🏆 jjk leaderboard — Classement des meilleurs sorciers
📦 jjk inventory — Voir vos objets et equipements
📈 jjk stats — Statistiques detaillees
❌ jjk fin — Abandonner un combat ou un defi en cours
`;
		return message.reply(helpText);
	},

	chooseCharacter: async function (message, args, pdata, fonts, save, usersData, senderID) {
		if (pdata.characterId) {
			const line = getLine(pdata.characterId);
			const stats = computeStats(line, pdata.level);
			return message.reply(fonts.bold(`Vous avez deja choisi ${stats.stageName}.\nUn personnage ne peut pas etre change, mais il continue d'evoluer avec vous !`));
		}

		const sub = args[1];
		if (!sub) {
			let text = `${fonts.bold("🌀 CHOISISSEZ VOTRE SORCIER")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
			text += `${fonts.bold("⚠️ Attention")} : ce choix est definitif, le personnage evoluera ensuite tout seul.\n\n`;
			CHARACTER_LINES.forEach(line => {
				const base = line.stages[0];
				text += `${line.emoji} ${line.id}. ${base.name} (${line.clan.replace(/[^\w\s]/g, '').trim()}) — Puissance ${base.power}\n`;
				text += `   Base: ${base.basic} | Ultime: ${base.ultimate}\n`;
			});
			text += `\nEnvoyez "jjk choose <numero>" pour valider votre choix.`;
			return message.reply(text);
		}

		const idx = parseInt(sub);
		const line = getLine(idx);
		if (!line) return message.reply(fonts.bold("Numero de personnage invalide. Utilisez 'jjk choose' pour voir la liste."));

		pdata.characterId = line.id;
		pdata.level = 1;
		pdata.xp = 0;
		pdata.wins = 0;
		pdata.losses = 0;
		pdata.rank = "4ème Grade";
		await save();

		const stats = computeStats(line, pdata.level);
		return message.reply(fonts.bold(`✅ Vous avez choisi ${stats.stageName} !\n${line.emoji} Affiliation : ${line.clan}\n⚡ Technique de base : ${stats.basic}\n💥 Technique ultime : ${stats.ultimate}\n\nUtilisez "jjk quest" pour commencer votre aventure.`));
	},

	showProfile: async function (message, pdata, fonts, usersData, senderID) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous n'avez pas encore choisi de personnage. Utilisez 'jjk choose' pour commencer."));
		}
		const line = getLine(pdata.characterId);
		const stats = computeStats(line, pdata.level);
		const xpNeeded = xpForLevel(pdata.level);
		const totalFights = pdata.wins + pdata.losses;
		const winRate = totalFights > 0 ? Math.round((pdata.wins / totalFights) * 100) : 0;

		const ranks = ["4ème Grade", "3ème Grade", "2ème Grade", "1er Grade", "Semi-Grade Special", "Grade Special", "Legendaire", "Roi des Fleaux"];
		const rankIndex = Math.min(Math.floor(pdata.level / 8), ranks.length - 1);
		const currentRank = ranks[rankIndex];
		if (pdata.rank !== currentRank) pdata.rank = currentRank;

		const profileText = `
${fonts.bold("🌀 CARTE DE SORCIER")}
━━━━━━━━━━━━━━━━━━━━━━━
${fonts.bold(stats.stageName)}
${line.emoji} ${fonts.bold("Affiliation")} : ${line.clan}

${fonts.bold("Niveau")} : ${pdata.level}${pdata.level >= MAX_LEVEL ? " (MAX)" : ""}
${fonts.bold("Experience")} : ${pdata.xp} / ${xpNeeded}
${fonts.bold("Grade")} : ${pdata.rank}
${fonts.bold("Puissance")} : ${stats.power}

${fonts.bold("Technique de base")} : ${stats.basic}
${fonts.bold("Technique ultime")} : ${stats.ultimate}

${fonts.bold("Victoires")} : ${pdata.wins}
${fonts.bold("Defaites")} : ${pdata.losses}
${fonts.bold("Taux de victoire")} : ${winRate}%
${fonts.bold("Missions completes")} : ${pdata.completedQuests?.length || 0}`;

		if (!canvasAvailable) return message.reply(profileText);

		try {
			const theme = pickTheme();
			const ownerName = (await usersData.getName(senderID).catch(() => null)) || "Sorcier Inconnu";
			const avatar = await fetchAvatar(senderID);
			const canvas = await this.buildProfileCanvas({
				ownerName, stageName: stats.stageName, clan: line.clan,
				level: pdata.level, xp: pdata.xp, xpNeeded, rank: pdata.rank,
				power: stats.power, basic: stats.basic, ultimate: stats.ultimate,
				wins: pdata.wins, losses: pdata.losses, winRate,
				completedQuests: pdata.completedQuests?.length || 0
			}, theme, avatar);

			const cacheDir = path.join(__dirname, "cache");
			if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
			const outPath = path.join(cacheDir, `jjk_profile_${Date.now()}.png`);
			fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
			await message.reply({ body: profileText, attachment: fs.createReadStream(outPath) });
			setTimeout(() => { try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {} }, 30000);
		} catch (e) {
			console.error("JJK profile canvas error:", e);
			return message.reply(profileText);
		}
	},

	buildProfileCanvas: async function (data, t, avatar) {
		ensureFonts();
		const W = 1500, H = 820;
		const canvas = createCanvas(W, H);
		const ctx = canvas.getContext("2d");

		drawDomainBg(ctx, W, H, t);

		T(ctx, "SORCIER INDEX", 60, 70, 22, t.primary, { letterSpacing: 6 });
		T(ctx, data.ownerName.toUpperCase(), 60, 112, 38, t.text, { letterSpacing: 1 });
		GL(ctx, 60, 145, W - 60, 145, t.primary);

		drawSquareAvatar(ctx, avatar, W - 196, 50, 136, t);
		T(ctx, data.rank.toUpperCase(), W - 128, 210, 16, t.secondary, { align: "center", letterSpacing: 2 });
		T(ctx, data.clan.replace(/[^\w\s]/g, '').trim().toUpperCase(), W - 128, 230, 13, t.secondary, { align: "center", letterSpacing: 1 });

		T(ctx, data.stageName.toUpperCase(), 60, 195, 26, t.primary, { letterSpacing: 1 });

		const colX = 60, colW = (W - 120 - 40) / 2;
		const rowY = 250;
		T(ctx, "PROGRESSION", colX, rowY, 18, t.primary, { letterSpacing: 3 });

		const xpRatio = data.xpNeeded > 0 ? data.xp / data.xpNeeded : 0;
		T(ctx, "NIVEAU " + data.level, colX, rowY + 46, 20, t.text, { letterSpacing: 1 });
		drawBar(ctx, colX, rowY + 66, colW, 18, xpRatio, t.secondary, t.primary);
		T(ctx, `${data.xp} / ${data.xpNeeded} XP`, colX, rowY + 104, 15, t.secondary, { letterSpacing: 1 });

		const statsRows = [
			["PUISSANCE", numbers.apply("monospace", data.power)],
			["VICTOIRES", numbers.apply("monospace", data.wins)],
			["DEFAITES", numbers.apply("monospace", data.losses)],
			["TAUX DE VICTOIRE", numbers.apply("monospace", data.winRate) + "%"]
		];
		statsRows.forEach((row, i) => {
			const y = rowY + 150 + i * 56;
			ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = t.primary;
			rr(ctx, colX, y - 24, colW, 44, 6); ctx.fill(); ctx.restore();
			T(ctx, row[0], colX + 20, y, 17, t.secondary, { letterSpacing: 1 });
			T(ctx, String(row[1]), colX + colW - 20, y, 22, t.text, { align: "right" });
		});

		const col2X = colX + colW + 40;
		T(ctx, "TECHNIQUES & MISSIONS", col2X, rowY, 18, t.primary, { letterSpacing: 3 });
		const techRows = [
			["BASIQUE", data.basic],
			["ULTIME", data.ultimate],
			["MISSIONS", data.completedQuests + " terminees"]
		];
		techRows.forEach((row, i) => {
			const y = rowY + 50 + i * 70;
			ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = t.primary;
			rr(ctx, col2X, y - 24, colW, 58, 6); ctx.fill(); ctx.restore();
			T(ctx, row[0], col2X + 20, y - 6, 15, t.secondary, { letterSpacing: 2 });
			T(ctx, row[1], col2X + 20, y + 22, 19, t.text, {});
		});

		T(ctx, `${t.name.toUpperCase()} INDEX`, W / 2, H - 36, 14, t.secondary, { align: "center", letterSpacing: 3 });

		return canvas;
	},

	showRoster: async function (message, fonts) {
		let text = `${fonts.bold("🌀 LISTE DES PERSONNAGES")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
		CHARACTER_LINES.forEach(line => {
			text += `\n${line.emoji} ${fonts.bold(String(line.id) + ". " + line.stages[0].name)} (${line.clan})\n`;
			line.stages.forEach(stage => {
				text += `  Niv.${stage.minLevel}+ — ${stage.name.split('(')[1]?.replace(')', '') || stage.name} — Puissance ${stage.power}\n`;
			});
		});
		text += `\n\nUtilisez "jjk choose <numero>" pour choisir votre personnage.`;
		return message.reply(text);
	},

	handleQuest: async function (message, args, pdata, fonts, save, senderID, threadID) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous devez d'abord choisir un personnage avec 'jjk choose'."));
		}
		if (userBattle[senderID]) {
			return message.reply(fonts.bold("Vous etes deja en plein combat. Tapez 'a', 'b', 'x', 'c', 'd' ou 'fin'."));
		}

		const sub = args[1];
		if (!sub) {
			let text = `${fonts.bold("🎯 MISSIONS DISPONIBLES")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
			QUESTS.forEach(q => {
				const locked = pdata.level < q.minLevel;
				const completed = pdata.completedQuests?.includes(q.id);
				text += `\n${q.id}. ${q.name}${locked ? " 🔒" : ""}${completed ? " ✅" : ""}\n`;
				text += `   Niveau requis : ${q.minLevel} | Cible : ${q.enemyName}\n`;
				text += `   Recompense : ${q.xp} XP, ${numbers.money(q.gold)}\n`;
			});
			text += `\n${fonts.bold("Missions terminees")} : ${pdata.completedQuests?.length || 0}/${QUESTS.length}`;
			text += `\nUtilisez "jjk quest <numero>" pour lancer un combat.`;
			return message.reply(text);
		}

		const qid = parseInt(sub);
		const quest = QUESTS.find(q => q.id === qid);
		if (!quest) return message.reply(fonts.bold("Numero de mission invalide."));
		if (pdata.level < quest.minLevel) {
			return message.reply(fonts.bold(`Niveau insuffisant. Cette mission requiert le niveau ${quest.minLevel}, vous etes niveau ${pdata.level}.`));
		}
		if (pdata.completedQuests?.includes(qid)) {
			return message.reply(fonts.bold("Vous avez deja termine cette mission."));
		}

		const line = getLine(pdata.characterId);
		const stats = computeStats(line, pdata.level);
		const battleId = `${threadID}_${senderID}_${Date.now()}`;

		battles[battleId] = {
			id: battleId,
			type: "quest",
			threadID,
			p1id: senderID,
			p2id: null,
			name: { p1: stats.stageName, p2: quest.enemyName },
			power: { p1: stats.power, p2: quest.enemyPower },
			basic: { p1: stats.basic, p2: "Attaque du Fleau" },
			ultimate: { p1: stats.ultimate, p2: "Technique Maudite Interdite" },
			hp: { p1: 100, p2: 100 },
			chakra: { p1: 100, p2: 100 },
			defending: null,
			quest
		};
		userBattle[senderID] = battleId;

		return message.reply(fonts.bold(`⚔️ COMBAT DE MISSION\n━━━━━━━━━━━━━━\n${stats.stageName} VS ${quest.enemyName}\n\n${COMBAT_HELP}`));
	},

	handleTrain: async function (message, pdata, fonts, save, user) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous devez d'abord choisir un personnage avec 'jjk choose'."));
		}
		const now = Date.now();
		if (pdata.lastTrain && (now - pdata.lastTrain) < TRAIN_COOLDOWN_MS) {
			const remain = Math.ceil((TRAIN_COOLDOWN_MS - (now - pdata.lastTrain)) / 60000);
			return message.reply(fonts.bold(`⏰ Vous devez encore attendre ${remain} minute(s) avant de vous entrainer a nouveau.`));
		}

		pdata.lastTrain = now;
		const xpGain = randomBetween(10, 25);
		const goldGain = randomBetween(30, 100);
		const result = addXp(pdata, xpGain);
		user.money = (user.money || 0) + goldGain;

		await save();

		let text = `${fonts.bold("🏋️ SEANCE D'ENTRAINEMENT")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
		text += `Vous vous etes entraine avec acharnement pour maitriser votre energie maudite.\n`;
		text += `Recompense : +${xpGain} XP, +${numbers.money(goldGain)}\n`;
		if (result.leveledUp) text += `⭐ Niveau superieur ! Vous etes maintenant niveau ${result.newLevel}.\n`;
		if (result.evolved) text += `✨ Votre personnage a evolue : ${result.newStageName} !\n`;
		text += `\nRevenez dans ${Math.round(TRAIN_COOLDOWN_MS / 60000)} minutes pour vous entrainer a nouveau.`;

		return message.reply(text);
	},

	handleDuelChallenge: async function (message, event, pdata, fonts, usersData, senderID, threadID, api) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous devez d'abord choisir un personnage avec 'jjk choose'."));
		}
		if (userBattle[senderID]) {
			return message.reply(fonts.bold("Vous etes deja en plein combat."));
		}
		if (pendingDuels[threadID]) {
			return message.reply(fonts.bold("Un defi de duel est deja en attente dans ce groupe."));
		}

		const mentionIDs = Object.keys(event.mentions || {}).filter(id => id !== senderID);
		const targetID = mentionIDs[0];
		if (!targetID) {
			return message.reply(fonts.bold("Mentionnez un utilisateur a defier. Exemple : jjk duel @utilisateur"));
		}
		if (userBattle[targetID]) {
			return message.reply(fonts.bold("Cet utilisateur est deja en plein combat."));
		}

		const targetUser = await usersData.get(targetID);
		const targetData = targetUser?.data?.jjk;
		if (!targetData || !targetData.characterId) {
			return message.reply(fonts.bold("Cet utilisateur n'a pas encore choisi de personnage."));
		}

		pendingDuels[threadID] = { challenger: senderID, target: targetID, ts: Date.now() };

		const targetName = (await usersData.getName(targetID).catch(() => null)) || "Sorcier";
		return message.reply({
			body: `${fonts.bold("⚔️ DEFI DE DUEL")}\n━━━━━━━━━━━━━━\n@${targetName}, vous etes defie en duel !\nRepondez "accepter" pour combattre ou "refuser" pour decliner.`,
			mentions: [{ tag: `@${targetName}`, id: targetID }]
		});
	},

	showLeaderboard: async function (message, fonts, usersData) {
		try {
			const allUsers = await usersData.getAll();
			const ranked = [];
			for (const [uid, u] of Object.entries(allUsers)) {
				const nd = u.data?.jjk;
				if (nd && nd.characterId) {
					ranked.push({
						uid,
						name: u.name || `User ${uid}`,
						level: nd.level || 1,
						wins: nd.wins || 0,
						losses: nd.losses || 0,
						characterId: nd.characterId
					});
				}
			}
			ranked.sort((a, b) => b.level - a.level || b.wins - a.wins);
			const top10 = ranked.slice(0, 10);

			let text = `${fonts.bold("🏆 CLASSEMENT DES SORCIERS")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
			if (top10.length === 0) {
				text += "Aucun sorcier n'a encore choisi de personnage.";
				return message.reply(text);
			}
			top10.forEach((u, i) => {
				const line = getLine(u.characterId);
				const stats = line ? computeStats(line, u.level) : null;
				const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${fonts.bold("#" + (i + 1))}`;
				text += `\n${medal} ${fonts.bold(u.name)}\n`;
				text += `   ${stats ? stats.stageName : "Sorcier"} — Niveau ${u.level}\n`;
				text += `   Victoires : ${u.wins} | Defaites : ${u.losses}\n`;
			});

			if (!canvasAvailable) return message.reply(text);

			const theme = pickTheme();
			const rows = await Promise.all(top10.map(async (u) => {
				const line = getLine(u.characterId);
				const stats = line ? computeStats(line, u.level) : null;
				return {
					name: u.name,
					subtitle: `NIVEAU ${u.level} - ${stats ? stats.stageName.toUpperCase() : ""}`,
						value: String(u.wins),
						avatar: await fetchAvatar(u.uid)
				};
			}));

			await renderAndAttach(
				message, text,
				this.buildRankingCanvas("CLASSEMENT DES SORCIERS", rows, theme),
				"jjk_leaderboard"
			);
		} catch (e) {
			console.error("JJK leaderboard error:", e);
			return message.reply(fonts.bold("Erreur lors du chargement du classement."));
		}
	},

	buildRankingCanvas: async function (title, rows, t) {
		ensureFonts();
		const rowH = 92;
		const headerH = 200;
		const footH = 70;
		const W = 1500;
		const H = headerH + rows.length * rowH + footH;
		const canvas = createCanvas(W, H);
		const ctx = canvas.getContext("2d");

		drawDomainBg(ctx, W, H, t);

		T(ctx, "RANKING INDEX", 60, 70, 22, t.primary, { letterSpacing: 6 });
		T(ctx, title.toUpperCase(), 60, 112, 38, t.text, { letterSpacing: 1 });
		GL(ctx, 60, 150, W - 60, 150, t.primary);

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const y = headerH + i * rowH;

			ctx.save();
			ctx.globalAlpha = i % 2 === 0 ? 0.05 : 0.0;
			ctx.fillStyle = t.primary;
			ctx.fillRect(60, y, W - 120, rowH - 14);
			ctx.restore();

			const rankSize = i < 3 ? 30 : 22;
			T(ctx, `${i + 1}`, 95, y + (rowH - 14) / 2, rankSize, i < 3 ? t.text : t.secondary, { align: "center", weight: "bold" });
			if (i < 3) {
				ctx.save();
				ctx.strokeStyle = t.primary; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
				ctx.beginPath(); ctx.arc(95, y + (rowH - 14) / 2, 26, 0, Math.PI * 2); ctx.stroke();
				ctx.restore();
			}

			if (row.avatar) {
				drawSquareAvatar(ctx, row.avatar, 130, y + 4, rowH - 22, t);
			} else {
				ctx.save();
				rr(ctx, 130, y + 4, rowH - 22, rowH - 22, 8);
				ctx.fillStyle = t.secondary; ctx.fill();
				ctx.restore();
			}

			const textX = 130 + (rowH - 22) + 24;
			T(ctx, row.name.toUpperCase(), textX, y + (rowH - 14) / 2 - 14, 20, t.text, { letterSpacing: 1 });
			T(ctx, row.subtitle || "", textX, y + (rowH - 14) / 2 + 14, 14, t.secondary, { letterSpacing: 1 });

			T(ctx, numbers.apply("monospace", row.value), W - 80, y + (rowH - 14) / 2, 26, t.primary, { align: "right", weight: "bold" });
		}

		GL(ctx, 60, H - footH, W - 60, H - footH, t.primary);
		T(ctx, `${t.name.toUpperCase()} INDEX`, W / 2, H - 30, 14, t.secondary, { align: "center", letterSpacing: 3 });

		return canvas;
	},

	showRankInfo: async function (message, pdata, fonts, save) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous devez d'abord choisir un personnage avec 'jjk choose'."));
		}

		const ranks = ["4ème Grade", "3ème Grade", "2ème Grade", "1er Grade", "Semi-Grade Special", "Grade Special", "Legendaire", "Roi des Fleaux"];
		const rankIndex = Math.min(Math.floor(pdata.level / 8), ranks.length - 1);
		const currentRank = ranks[rankIndex];
		const nextRank = ranks[Math.min(rankIndex + 1, ranks.length - 1)];
		const nextLevel = (rankIndex + 1) * 8;

		if (pdata.rank !== currentRank) {
			pdata.rank = currentRank;
			await save();
		}

		let text = `${fonts.bold("🏅 INFORMATIONS SUR LE GRADE")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
		text += `Grade actuel : ${fonts.bold(currentRank)}\n`;
		text += `Niveau : ${pdata.level}\n`;
		if (pdata.level < MAX_LEVEL) {
			text += `Prochain grade : ${nextRank} (niveau ${nextLevel})\n`;
			text += `Progression : ${pdata.level}/${nextLevel}\n`;
		} else {
			text += `🎉 Vous avez atteint le grade maximum !\n`;
		}
		text += `\n${fonts.bold("📊 GRADES DISPONIBLES:")}\n`;
		ranks.forEach((r, i) => {
			const lvl = i * 8 + 1;
			const unlocked = pdata.level >= lvl;
			text += `${unlocked ? "✅" : "🔒"} ${r} (Niv. ${lvl}+)\n`;
		});

		return message.reply(text);
	},

	showInventory: async function (message, pdata, fonts) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous devez d'abord choisir un personnage avec 'jjk choose'."));
		}

		const items = pdata.items || [];
		let text = `${fonts.bold("📦 INVENTAIRE")}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
		if (items.length === 0) {
			text += "Votre inventaire est vide.\n";
			text += "Completer des missions pour obtenir des objets maudits !";
		} else {
			items.forEach((item, i) => {
				text += `${i + 1}. ${item.name} (${item.type || "Objet"}) — ${item.description || ""}\n`;
			});
		}
		text += `\n${fonts.bold("Objets totaux")} : ${items.length}`;

		return message.reply(text);
	},

	showDetailedStats: async function (message, pdata, fonts, usersData, senderID) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous devez d'abord choisir un personnage avec 'jjk choose'."));
		}

		const line = getLine(pdata.characterId);
		const stats = computeStats(line, pdata.level);
		const totalFights = pdata.wins + pdata.losses;
		const winRate = totalFights > 0 ? Math.round((pdata.wins / totalFights) * 100) : 0;
		const xpNeeded = xpForLevel(pdata.level);

		const text = `
${fonts.bold("📊 STATISTIQUES DETAILLEES")}
━━━━━━━━━━━━━━━━━━━━━━━
${fonts.bold("Niveau")} : ${pdata.level}
${fonts.bold("Experience")} : ${pdata.xp}/${xpNeeded}
${fonts.bold("Grade")} : ${pdata.rank}
${fonts.bold("Puissance")} : ${stats.power}

${fonts.bold("📈 COMBATS")}
Victoires : ${pdata.wins}
Defaites : ${pdata.losses}
Total : ${totalFights}
Taux de victoire : ${winRate}%

${fonts.bold("🎯 MISSIONS")}
Terminees : ${pdata.completedQuests?.length || 0}/${QUESTS.length}

${fonts.bold("⚡ TECHNIQUES")}
Basique : ${stats.basic}
Ultime : ${stats.ultimate}

${fonts.bold("📅 GENERAL")}
Cree le : ${new Date(pdata.createdAt).toLocaleDateString()}
Dernier entrainement : ${pdata.lastTrain ? new Date(pdata.lastTrain).toLocaleDateString() : "Jamais"}`;

		return message.reply(text);
	},

	resetCharacter: async function (message, args, pdata, fonts, save) {
		if (!pdata.characterId) {
			return message.reply(fonts.bold("Vous n'avez pas de personnage a reinitialiser."));
		}

		const confirm = (args[1] || "").toLowerCase();
		if (confirm !== "confirm") {
			return message.reply(fonts.bold(`
⚠️ ATTENTION : Reinitialiser votre personnage supprimera toute votre progression !
Cette action est DEFINITIVE.
Pour confirmer, envoyez : jjk reset confirm
			`));
		}

		pdata.characterId = null;
		pdata.level = 1;
		pdata.xp = 0;
		pdata.wins = 0;
		pdata.losses = 0;
		pdata.lastTrain = null;
		pdata.lastQuestId = null;
		pdata.rank = "4ème Grade";
		pdata.completedQuests = [];
		pdata.items = [];
		await save();

		return message.reply(fonts.bold("✅ Votre personnage a ete reinitialise. Vous pouvez maintenant en choisir un nouveau avec 'jjk choose'."));
	},

	onChat: async function ({ event, message, api, usersData }) {
		const userID = event.senderID;
		const threadID = event.threadID;
		const body = (event.body || "").trim().toLowerCase();
		if (!body) return;

		const pending = pendingDuels[threadID];
		if (pending && userID === pending.target && (body === "accepter" || body === "accepte" || body === "refuser" || body === "refuse")) {
			if (body === "refuser" || body === "refuse") {
				delete pendingDuels[threadID];
				return message.reply(fonts.bold("Le duel a ete refuse."));
			}

			delete pendingDuels[threadID];
			const challengerUser = await usersData.get(pending.challenger);
			const targetUser = await usersData.get(pending.target);
			const cData = challengerUser?.data?.jjk;
			const tData = targetUser?.data?.jjk;
			if (!cData || !cData.characterId || !tData || !tData.characterId) {
				return message.reply(fonts.bold("Impossible de lancer le duel : un des joueurs n'a plus de personnage valide."));
			}

			const cLine = getLine(cData.characterId);
			const tLine = getLine(tData.characterId);
			const cStats = computeStats(cLine, cData.level);
			const tStats = computeStats(tLine, tData.level);

			const cName = (await usersData.getName(pending.challenger).catch(() => null)) || "Sorcier 1";
			const tName = (await usersData.getName(pending.target).catch(() => null)) || "Sorcier 2";

			const battleId = `${threadID}_duel_${Date.now()}`;
			battles[battleId] = {
				id: battleId,
				type: "duel",
				threadID,
				p1id: pending.challenger,
				p2id: pending.target,
				ownerName: { p1: cName, p2: tName },
				name: { p1: cStats.stageName, p2: tStats.stageName },
				power: { p1: cStats.power, p2: tStats.power },
				basic: { p1: cStats.basic, p2: tStats.basic },
				ultimate: { p1: cStats.ultimate, p2: tStats.ultimate },
				hp: { p1: 100, p2: 100 },
				chakra: { p1: 100, p2: 100 },
				defending: null,
				turn: "p1"
			};
			userBattle[pending.challenger] = battleId;
			userBattle[pending.target] = battleId;

			return message.reply({
				body: `${fonts.bold("⚔️ DUEL ACCEPTE")}\n━━━━━━━━━━━━━━\n${cStats.stageName} (${cName}) VS ${tStats.stageName} (${tName})\n\n${COMBAT_HELP}\n\n@${cName}, a vous de jouer !`,
				mentions: [{ tag: `@${cName}`, id: pending.challenger }]
			});
		}

		const battleId = userBattle[userID];
		if (!battleId) return;
		const battle = battles[battleId];
		if (!battle) { delete userBattle[userID]; return; }

		if (body === "fin" || body === "quit" || body === "abandon") {
			cleanupBattle(battleId);
			return message.reply(fonts.bold("Le combat a ete abandonne."));
		}

		if (!['a', 'b', 'x', 'c', 'd'].includes(body)) return;

		if (battle.type === "quest") {
			if (userID !== battle.p1id) return;

			let msg = "";
			const r1 = resolveTurn(battle, 'p1', body);
			msg += formatAction(r1, battle);

			if (battle.hp.p2 > 0) {
				const botLetter = aiChoose(battle);
				const r2 = resolveTurn(battle, 'p2', botLetter);
				msg += formatAction(r2, battle);
			}

			msg += statusBars(battle);

			if (battle.hp.p1 <= 0 || battle.hp.p2 <= 0) {
				const user = await usersData.get(userID);
				const pdata = user.data.jjk;
				const won = battle.hp.p2 <= 0 && battle.hp.p1 > 0;

				let rewardMsg = "";
				if (won) {
					pdata.wins += 1;
					const result = addXp(pdata, battle.quest.xp);
					user.money = (user.money || 0) + battle.quest.gold;
					if (!pdata.completedQuests) pdata.completedQuests = [];
					if (!pdata.completedQuests.includes(battle.quest.id)) {
						pdata.completedQuests.push(battle.quest.id);
					}
					rewardMsg = `🏆 VICTOIRE ! Vous avez vaincu ${battle.quest.enemyName}.\n`;
					rewardMsg += `Recompense : +${battle.quest.xp} XP, +${numbers.money(battle.quest.gold)}\n`;
					if (result.leveledUp) rewardMsg += `⭐ Niveau superieur ! Vous etes maintenant niveau ${result.newLevel}.\n`;
					if (result.evolved) rewardMsg += `✨ Votre personnage a evolue : ${result.newStageName} !\n`;
				} else {
					pdata.losses += 1;
					const consolationXp = Math.floor(battle.quest.xp * 0.25);
					const result = addXp(pdata, consolationXp);
					rewardMsg = `💀 DEFAITE face a ${battle.quest.enemyName}.\n`;
					rewardMsg += `Recompense de consolation : +${consolationXp} XP\n`;
					if (result.leveledUp) rewardMsg += `⭐ Niveau superieur ! Vous etes maintenant niveau ${result.newLevel}.\n`;
				}

				await usersData.set(userID, user);
				cleanupBattle(battleId);
				msg += `\n${rewardMsg}`;
				return message.reply(msg);
			}

			return message.reply(msg);
		}

		if (battle.type === "duel") {
			const currentId = battle.turn === "p1" ? battle.p1id : battle.p2id;
			if (userID !== currentId) return;

			const key = battle.turn;
			const r = resolveTurn(battle, key, body);
			let msg = formatAction(r, battle);
			msg += statusBars(battle);

			if (battle.hp.p1 <= 0 || battle.hp.p2 <= 0) {
				const p1Won = battle.hp.p2 <= 0 && battle.hp.p1 > 0;
				const winnerID = p1Won ? battle.p1id : battle.p2id;
				const loserID = p1Won ? battle.p2id : battle.p1id;
				const winnerName = p1Won ? battle.ownerName.p1 : battle.ownerName.p2;

				const winnerUser = await usersData.get(winnerID);
				const loserUser = await usersData.get(loserID);
				const wpdata = winnerUser.data.jjk;
				const lpdata = loserUser.data.jjk;

				wpdata.wins += 1;
				lpdata.losses += 1;
				const winXp = 50 + wpdata.level * 2;
				const winGold = 100 + wpdata.level * 5;
				const loseXp = 15;

				const wResult = addXp(wpdata, winXp);
				const lResult = addXp(lpdata, loseXp);
				winnerUser.money = (winnerUser.money || 0) + winGold;

				await usersData.set(winnerID, winnerUser);
				await usersData.set(loserID, loserUser);
				cleanupBattle(battleId);

				msg += `\n🏆 VICTOIRE DE ${winnerName} !\n`;
				msg += `${battle.ownerName.p1} : +${winXp} XP${p1Won ? ", +" + numbers.money(winGold) : ""}\n`;
				msg += `${battle.ownerName.p2} : ${p1Won ? "+" + loseXp + " XP" : "+" + winXp + " XP, +" + numbers.money(winGold)}\n`;
				if (wResult.evolved) msg += `✨ ${winnerName} a evolue : ${wResult.newStageName} !\n`;

				return message.reply(msg);
			}

			battle.turn = key === "p1" ? "p2" : "p1";
			const nextID = battle.turn === "p1" ? battle.p1id : battle.p2id;
			const nextName = battle.turn === "p1" ? battle.ownerName.p1 : battle.ownerName.p2;
			msg += `@${nextName}, a vous de jouer !`;

			return message.reply({
				body: msg,
				mentions: [{ tag: `@${nextName}`, id: nextID }]
			});
		}
	}
};
