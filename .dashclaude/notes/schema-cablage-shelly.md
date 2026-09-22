# Schéma de câblage — Système Chauffe Maison connecté

## Vue d'ensemble du système

```
┌─────────────────────────────────────────────────────────┐
│                    RÉSEAU WiFi MAISON                    │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
           ▼                          ▼
  ┌─────────────────┐      ┌───────────────────┐
  │  Shelly 1PM     │      │ Shelly Plus H&T   │
  │  (tableau élec) │      │ (entrée maison)   │
  │                 │      │                   │
  │  Commande le    │◄─────│ Mesure temp/humid │
  │  chauffage      │ scène│ toutes les X min  │
  │  on/off         │      │ batterie ~1 an    │
  └────────┬────────┘      └───────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ Contacteur      │
  │ GE CTX 63A      │
  │ (conservé)      │
  └──┬───┬───┬───┬──┘
     │   │   │   │
     ▼   ▼   ▼   ▼
    Z1   Z2  Z3  Z4     (4 zones chauffage)
```

## Matériel

| # | Élément | Statut |
|---|---------|--------|
| 1 | Shelly 1PM (relais 16A WiFi + mesure conso) | Déjà en possession |
| 2 | Shelly Plus H&T (capteur temp/humidité WiFi) | À acheter ~30€ |
| 3 | Fil souple 1.5mm² (quelques cm) | À avoir |
| 4 | Interrupteur mural (optionnel, override manuel) | Optionnel |

## Bornes du Shelly 1PM

- **L** = Entrée Phase (230V)
- **N** = Neutre
- **SW** = Entrée interrupteur (optionnel)
- **O** = Sortie relais (contact commuté)

## Bornes du contacteur GE CTX 63A

- **A1** = Bobine (entrée commande)
- **A2** = Bobine (retour neutre)

## Schéma de câblage complet du tableau

```
                         ARRIVÉE TABLEAU
                         Phase    Neutre
                           │        │
           ┌───────────────┼────────┼──────────────────────┐
           │               │        │    BARRETTE NEUTRE    │
           │               │        ├─────────────────┐     │
           │               │        │                 │     │
           │    ┌──────────┴──┐     │                 │     │
           │    │ REGUL-CHAUFF│     │                 │     │
           │    │  C10 Legrand│     │                 │     │
           │    │  pos.8      │     │                 │     │
           │    └──────┬──────┘     │                 │     │
           │           │            │                 │     │
           │        Phase           │                 │     │
           │           │            │                 │     │
           │    ┌──────┴──────┐     │                 │     │
           │    │  SHELLY 1PM │     │                 │     │
           │    │             │     │                 │     │
           │    │  L ◄────────┘     │                 │     │
           │    │  N ◄──────────────┘                 │     │
           │    │  SW ◄── (interr. mural, optionnel)  │     │
           │    │  O ──────────┐                      │     │
           │    └──────────────┼──────────────────┐   │     │
           │                   │                  │   │     │
           │    ┌──────────────┼──────────────┐   │   │     │
           │    │  CONTACTEUR GE CTX 63A      │   │   │     │
           │    │                              │   │   │     │
           │    │  A1 (bobine) ◄───────────────┘   │   │     │
           │    │  A2 (bobine) ◄───────────────────┘   │     │
           │    │                                      │     │
           │    │  Entrée puissance ◄──────────────────┼─────┤
           │    │  (Phase depuis barrette phase)       │     │
           │    │                                      │     │
           │    │  Sortie puissance ──┐                │     │
           │    └─────────────────────┼────────────────┘     │
           │                          │                      │
           │                     Phase commutée              │
           │                     (passe quand bobine ON)     │
           │                          │                      │
           │    ┌─────────────────────┼──────────────────┐   │
           │    │                     │   DISJONCTEURS    │   │
           │    │                     │   MOELLER XPOLE   │   │
           │    │     ┌───────┬───────┴───┬──────────┐   │   │
           │    │     │       │           │          │   │   │
           │    │  ┌──┴──┐ ┌──┴──┐  ┌────┴──┐ ┌────┴┐  │   │
           │    │  │ C16 │ │ C32 │  │  C20  │ │C20/ │  │   │
           │    │  │pos.4│ │p.4b │  │ pos.5 │ │C32  │  │   │
           │    │  │     │ │     │  │       │ │pos.6│  │   │
           │    │  └──┬──┘ └──┬──┘  └───┬───┘ └──┬──┘  │   │
           │    │     │       │         │        │     │   │
           │    └─────┼───────┼─────────┼────────┼─────┘   │
           │          │       │         │        │         │
           │          │N      │N        │N       │N        │
           │          ├───────┼─────────┼────────┼─────────┤
           │          │       │         │        │         │
           │          ▼       ▼         ▼        ▼         │
           │       ZONE 1  ZONE 2   ZONE 3   ZONE 4      │
           │       Cuisine Couloir  Ch 1+2   RdC+Ch7     │
           │       SdB 1           SdB 2    Entrée       │
           │                                              │
           └──────────────────────────────────────────────┘
```

### Légende du flux électrique

| Étape | Trajet |
|-------|--------|
| 1 | Phase arrive au **C10** (REGUL-CHAUFF) |
| 2 | C10 alimente le **Shelly 1PM** (bornes L + N) |
| 3 | App/scène dit "ON" → Shelly envoie la phase sur **O** |
| 4 | **O** excite la bobine du contacteur (**A1**), retour par **A2** au neutre |
| 5 | Contacteur ferme ses contacts → la phase passe vers les **4 disjoncteurs Moeller** |
| 6 | Chaque disjoncteur protège et alimente sa **zone de radiateurs** |
| 7 | Retour par le **neutre** (barrette commune) |

## Résumé des connexions

| Depuis | Vers | Fil |
|--------|------|-----|
| C10 Phase | Shelly 1PM **L** | Phase 230V |
| C10 Neutre | Shelly 1PM **N** | Neutre |
| Shelly 1PM **O** | Contacteur **A1** | Commande bobine |
| Contacteur **A2** | Neutre (barrette) | Retour bobine |
| Shelly 1PM **SW** (optionnel) | Interrupteur mural | Override manuel |

## Capteur Shelly Plus H&T

- Emplacement : **entrée de la maison**
- Alimentation : batterie (pas de câblage)
- Connexion : WiFi (même réseau que le Shelly 1PM)
- Pas de liaison physique avec le Shelly 1PM — tout passe par le WiFi

## Scènes d'automatisation (à configurer dans l'app Shelly)

### Scène 1 — Chauffage matin
- **Condition horaire** : entre 6h et 8h
- **Condition température** : H&T < 18°C
- **Action** : allumer Shelly 1PM
- **Arrêt** : si température ≥ 19°C → éteindre (hystérésis 1°C)

### Scène 2 — Chauffage soir
- **Condition horaire** : entre 17h et 22h
- **Condition température** : H&T < 18°C
- **Action** : allumer Shelly 1PM
- **Arrêt** : si température ≥ 19°C → éteindre (hystérésis 1°C)

## Option interrupteur mural

Si tu veux un bouton physique en plus de l'app :
- Branche un interrupteur entre **SW** et **Neutre**
- Dans l'app Shelly, configure le SW en mode "toggle" ou "momentary"
- Tu pourras allumer/éteindre le chauffage physiquement ET via l'app

## Étapes d'installation

### Partie 1 — Câblage (tableau électrique)
1. **Couper le courant** au disjoncteur général
2. Débrancher l'ancien récepteur RF Chaffoteaux du contacteur
3. Câbler le Shelly 1PM selon le schéma ci-dessus (4 fils)
4. Remettre le courant
5. Vérifier que le Shelly s'allume (LED)

### Partie 2 — Configuration WiFi
6. Télécharger l'app **Shelly** (iOS/Android)
7. Ajouter le Shelly 1PM (il crée un réseau WiFi temporaire)
8. Le connecter au WiFi de la maison
9. Tester : allumer/éteindre depuis l'app → le contacteur doit cliquer

### Partie 3 — Capteur température
10. Insérer la batterie dans le Shelly Plus H&T
11. L'ajouter dans l'app Shelly
12. Le placer dans l'entrée de la maison

### Partie 4 — Automatisation
13. Créer les scènes dans l'app (matin + soir + arrêt)
14. Tester en forçant les conditions

### Partie 5 — Nettoyage
15. Retirer l'ancien thermostat Chaffoteaux (ne sert plus)
16. Retirer l'ancien récepteur RF (déjà débranché)

## Sécurité

- Toujours couper le courant au disjoncteur général avant intervention sur le tableau
- Le Shelly se branche sur le circuit REGUL-CHAUFF (C10) existant
- Ne pas toucher aux connexions puissance du contacteur (circuits chauffage)
- Le relais du Shelly commande uniquement la bobine (faible courant)
- Si pas à l'aise avec l'électricité, faire intervenir un électricien
