# Boulangerie Pilotage

Mini application web locale pour gérer :
- la mercuriale fournisseurs / matières premières,
- les fiches recettes,
- le calcul des coûts de production,
- une simulation simple de marge.

## Ouvrir l'application

Double-cliquez simplement sur `index.html`.

## Fonctions incluses

- Ajout / modification / suppression d'ingrédients
- Calcul automatique du coût unitaire d'un ingrédient
- Création de recettes avec quantités par ingrédient
- Calcul du coût matière, main-d'œuvre, énergie et charges indirectes
- Simulation de production par lot et marge théorique
- Sauvegarde automatique dans le navigateur (localStorage)
- Export / import JSON

## Remarques

- C'est un prototype exploitable immédiatement, sans installation.
- Les chiffres de tableau de bord reprennent quelques repères issus de votre plaquette comptable 2024-2025.
- Les recettes et mercuriales fournies sont des exemples de départ.

## Évolutions possibles

- gestion fournisseurs avec historique de prix,
- fiche technique par produit,
- inventaire / stock réel,
- bon de fabrication journalier,
- calcul de coût par gamme (pain, viennoiserie, snacking),
- version multi-utilisateur avec base de données.
