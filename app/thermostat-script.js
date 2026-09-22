// Thermostat Chauffe Maison - Script mJS pour Shelly Pro 1PM
// Pilotage du chauffage par plages horaires + seuil de temperature
// Version 1.0

var TIMER_INTERVAL = 60000; // 60 secondes
var RELAY_ID = 0;
var KVS_KEYS = ["enabled", "temp_target", "temp_hyst", "ht_temp",
  "s_lun", "s_mar", "s_mer", "s_jeu", "s_ven", "s_sam", "s_dim"];
var DAY_KEYS = ["s_dim", "s_lun", "s_mar", "s_mer", "s_jeu", "s_ven", "s_sam"];

function getConfig(callback) {
  var config = {};
  var remaining = KVS_KEYS.length;

  function onGet(key, res, err) {
    if (!err && res) {
      config[key] = res.value;
    }
    remaining--;
    if (remaining === 0) {
      callback(config);
    }
  }

  for (var i = 0; i < KVS_KEYS.length; i++) {
    (function (key) {
      Shelly.call("KVS.Get", { key: key }, function (res, err) {
        onGet(key, res, err);
      });
    })(KVS_KEYS[i]);
  }
}

function parseRanges(str) {
  // Parse "0600-0800,1700-2200" -> [{start:600, end:800}, {start:1700, end:2200}]
  if (!str || str === "") return [];
  var parts = str.split(",");
  var ranges = [];
  for (var i = 0; i < parts.length; i++) {
    var se = parts[i].split("-");
    if (se.length === 2) {
      ranges.push({ start: Number(se[0]), end: Number(se[1]) });
    }
  }
  return ranges;
}

function isInRange(hhmm, ranges) {
  for (var i = 0; i < ranges.length; i++) {
    if (hhmm >= ranges[i].start && hhmm < ranges[i].end) {
      return true;
    }
  }
  return false;
}

function setRelay(on) {
  Shelly.call("Switch.Set", { id: RELAY_ID, on: on }, function () {});
}

function checkThermostat() {
  getConfig(function (cfg) {
    // Verifier si le systeme est active
    if (cfg.enabled !== "1") {
      return;
    }

    var target = Number(cfg.temp_target);
    var hyst = Number(cfg.temp_hyst);
    var temp = Number(cfg.ht_temp);

    // Verifier que les valeurs sont valides
    if (isNaN(target) || isNaN(hyst) || isNaN(temp)) {
      print("Thermostat: valeurs invalides target=" + cfg.temp_target +
        " hyst=" + cfg.temp_hyst + " temp=" + cfg.ht_temp);
      return;
    }

    // Determiner le jour et l'heure
    var now = Shelly.getComponentStatus("sys").unixtime;
    if (!now || now === 0) {
      print("Thermostat: heure systeme non disponible");
      return;
    }

    var d = new Date(now * 1000);
    var dayIndex = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
    var hhmm = d.getHours() * 100 + d.getMinutes();
    var dayKey = DAY_KEYS[dayIndex];

    var schedule = cfg[dayKey] || "";
    var ranges = parseRanges(schedule);
    var inRange = isInRange(hhmm, ranges);

    if (!inRange) {
      // Hors plage horaire -> eteindre
      setRelay(false);
      print("Thermostat: hors plage (" + dayKey + " " + hhmm + ") -> OFF");
      return;
    }

    // Dans la plage horaire -> verifier la temperature
    if (temp < target) {
      setRelay(true);
      print("Thermostat: " + temp + " < " + target + " -> ON");
    } else if (temp >= target + hyst) {
      setRelay(false);
      print("Thermostat: " + temp + " >= " + (target + hyst) + " -> OFF");
    } else {
      print("Thermostat: " + temp + " dans hysteresis, pas de changement");
    }
  });
}

// Demarrer le timer
Timer.set(TIMER_INTERVAL, true, function () {
  checkThermostat();
});

// Execution initiale
checkThermostat();

print("Thermostat Chauffe Maison demarre - intervalle " + (TIMER_INTERVAL / 1000) + "s");
