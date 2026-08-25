import json


ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
CONTRACT = "contracts/age_of_spells_pvp.py"
COUNCIL_PROMPT = r"(?s).*Age of Spells Council.*"

STEAM_DAMAGE = (
    '{"valid":true,"reason":"ok","name":"Scalding Veil",'
    '"fusion":"Steam","element":"steam","primary_effect":"damage",'
    '"secondary_effect":"none","description":"A pressurized veil of steam '
    'surges forward and scalds the opposing mage."}'
)
STEAM_FORTIFY = (
    '{"valid":true,"reason":"ok","name":"Steam Bastion",'
    '"fusion":"Steam","element":"steam","primary_effect":"fortify",'
    '"secondary_effect":"none","description":"Boiling mist strikes the rival '
    'and hardens into a protective ward."}'
)
GRAND_STORM = (
    '{"valid":true,"reason":"ok","name":"Volcanic Razorstorm",'
    '"fusion":"Volcanic Storm","element":"storm",'
    '"primary_effect":"piercing","secondary_effect":"shield",'
    '"description":"Stone-laced winds cut through protection while circling '
    'their caster as a hardened gale."}'
)
WATER_WARD = (
    '{"valid":true,"reason":"ok","name":"Tidal Rampart",'
    '"fusion":"Living Stone","element":"nature","primary_effect":"shield",'
    '"secondary_effect":"none","description":"Water binds earth into a '
    'flowing rampart around the casting mage."}'
)
FIRE_DAMAGE = (
    '{"valid":true,"reason":"ok","name":"Twinfire Brand",'
    '"fusion":"Inferno","element":"fire","primary_effect":"damage",'
    '"secondary_effect":"none","description":"Two flames converge into a '
    'single brand that crashes into the rival."}'
)
ONE_MAN_STAND = (
    '{"valid":true,"reason":"ok","name":"Final Horizon",'
    '"fusion":"One Man Stand","element":"mythic",'
    '"primary_effect":"equalize","secondary_effect":"none",'
    '"description":"The arena bends until both mages stand upon the same final '
    'thread of life."}'
)
LONG_FLAVOR_DAMAGE = json.dumps({
    "valid": True,
    "reason": "ok",
    "name": "N" * 80,
    "fusion": "F" * 80,
    "element": "tempest",
    "primary_effect": "damage",
    "secondary_effect": "none",
    "description": "D" * 220,
})


def address(value):
    from genlayer.py.types import Address

    return Address(value)


def deploy_for(direct_vm, direct_deploy, player):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = player
    return contract


def view_for(contract, player):
    return contract.get_player_match(address(player))


def profile_for(contract, player):
    return contract.get_profile(address(player))


def create_open_match(contract, direct_vm, creator):
    direct_vm.sender = creator
    contract.create_match(address(ZERO_ADDRESS))
    return view_for(contract, creator)["match_id"]


def create_and_join(contract, direct_vm, first, second):
    match_id = create_open_match(contract, direct_vm, first)
    direct_vm.sender = second
    contract.join_match(match_id)
    return match_id


def mock_spell(direct_vm, response):
    direct_vm.mock_llm(COUNCIL_PROMPT, response)


def test_open_challenge_enters_lobby_and_can_be_cancelled(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)

    assert view_for(contract, direct_alice)["exists"] is False
    match_id = create_open_match(contract, direct_vm, direct_alice)
    waiting = view_for(contract, direct_alice)
    lobby = contract.get_lobby(address(direct_bob))["matches"]

    assert match_id == "aos-1"
    assert waiting["status"] == "waiting"
    assert waiting["opponent"] == ZERO_ADDRESS
    assert waiting["hand"] == []
    assert waiting["turn"] == 0
    assert lobby == [{
        "match_id": "aos-1",
        "creator": str(address(direct_alice)).lower(),
        "invited_player": ZERO_ADDRESS,
        "visibility": "open",
        "revision": 1,
    }]

    contract.cancel_match()
    assert view_for(contract, direct_alice)["status"] == "cancelled"
    assert contract.get_lobby(address(direct_bob))["matches"] == []


def test_private_match_starts_both_wallets_with_twelve_ingredients(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    contract.create_match(address(direct_bob))
    match_id = view_for(contract, direct_alice)["match_id"]

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("[EXPECTED] match_is_private"):
        contract.join_match(match_id)

    direct_vm.sender = direct_bob
    contract.join_match(match_id)
    first = view_for(contract, direct_alice)
    second = view_for(contract, direct_bob)

    assert first["status"] == "active"
    assert first["is_your_turn"] is True
    assert second["is_your_turn"] is False
    assert len(first["hand"]) == 12
    assert first["hand"].count("fire") == 3
    assert first["hand"].count("water") == 3
    assert first["hand"].count("air") == 3
    assert first["hand"].count("earth") == 3
    assert second["hand"] == first["hand"]
    assert first["opponent_hand_count"] == 12


def test_dual_fusion_burns_cards_resolves_damage_and_validates_consensus(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    mock_spell(direct_vm, STEAM_DAMAGE)

    incantation = "Bind fire and water into a pressurized steam blast."
    contract.forge_and_cast("fire", "water", "", incantation)
    alice = view_for(contract, direct_alice)
    bob = view_for(contract, direct_bob)
    spell = alice["last_your_spell"]

    assert len(alice["hand"]) == 10
    assert bob["your_health"] == 80
    assert bob["is_your_turn"] is True
    assert alice["turn"] == 2
    assert spell["name"] == "Scalding Veil"
    assert spell["fusion"] == "Steam"
    assert spell["tier"] == "dual"
    assert spell["ingredients"] == ["fire", "water"]
    assert spell["effects"] == [{
        "type": "damage",
        "target": "enemy",
        "value": 20,
        "shield_absorbed": 0,
        "health_damage": 20,
    }]
    assert alice["spell_history"] == [spell]
    assert direct_vm.run_validator() is True

    # Models may choose different creative presentation while independently
    # agreeing on the same offensive gameplay intent.
    direct_vm.clear_mocks()
    mock_spell(direct_vm, FIRE_DAMAGE)
    assert direct_vm.run_validator() is True

    direct_vm.clear_mocks()
    mock_spell(direct_vm, STEAM_FORTIFY)
    assert direct_vm.run_validator() is False


def test_generated_flavor_is_clamped_without_rejecting_a_valid_player_spell(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    mock_spell(direct_vm, LONG_FLAVOR_DAMAGE)

    contract.forge_and_cast(
        "fire",
        "water",
        "",
        "Compress flame and water into a damaging wave of scalding vapor.",
    )
    spell = view_for(contract, direct_alice)["last_your_spell"]

    assert spell["name"] == "N" * 32
    assert spell["fusion"] == "F" * 32
    assert spell["description"] == "D" * 140
    assert spell["element"] == "arcane"
    assert spell["primary_effect"] == "damage"
    assert direct_vm.run_validator() is True


def test_grand_fusion_can_combine_supported_piercing_and_shield(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    mock_spell(direct_vm, GRAND_STORM)

    contract.forge_and_cast(
        "fire",
        "air",
        "earth",
        "Raise a stone-edged volcanic wind that cuts through shields and guards me.",
    )
    alice = view_for(contract, direct_alice)
    bob = view_for(contract, direct_bob)
    spell = alice["last_your_spell"]

    assert len(alice["hand"]) == 9
    assert alice["your_shield"] == 12
    assert bob["your_health"] == 80
    assert spell["tier"] == "grand"
    assert spell["primary_effect"] == "piercing"
    assert spell["secondary_effect"] == "shield"
    assert spell["effects"][0]["type"] == "piercing"
    assert spell["effects"][0]["value"] == 20
    assert spell["effects"][1]["type"] == "shield"
    assert spell["effects"][1]["applied"] == 12
    assert direct_vm.run_validator() is True


def test_affinity_and_semantic_failures_are_atomic(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    before = view_for(contract, direct_alice)

    mock_spell(
        direct_vm,
        '{"valid":true,"reason":"ok","name":"Impossible Renewal",'
        '"fusion":"Wildfire","element":"fire","primary_effect":"heal",'
        '"secondary_effect":"none","description":"Flame and wind somehow '
        'claim to restore a wounded mage without support."}',
    )
    with direct_vm.expect_revert("[LLM_ERROR] fusion_primary_effect_invalid"):
        contract.forge_and_cast(
            "fire",
            "air",
            "",
            "Use only flame and wind to restore all of my wounds.",
        )
    assert view_for(contract, direct_alice) == before

    direct_vm.clear_mocks()
    mock_spell(
        direct_vm,
        '{"valid":false,"reason":"unselected_element","name":"",'
        '"fusion":"","element":"arcane","primary_effect":"",'
        '"secondary_effect":"none","description":""}',
    )
    with direct_vm.expect_revert("[EXPECTED] incantation_unselected_element"):
        contract.forge_and_cast(
            "water",
            "air",
            "",
            "Call upon fire and water to create a burning steam lance.",
        )
    assert view_for(contract, direct_alice) == before
    assert direct_vm.run_validator() is True


def test_fusion_inputs_are_checked_before_the_spell_council(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    match_id = create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("[EXPECTED] incantation_too_short"):
        contract.forge_and_cast("fire", "water", "", "too short")
    with direct_vm.expect_revert("[EXPECTED] incantation_too_long"):
        contract.forge_and_cast("fire", "water", "", "x" * 241)
    with direct_vm.expect_revert("[EXPECTED] fusion_requires_two_or_three_cards"):
        contract.forge_and_cast("fire", "", "", "Cast a legal sounding flame spell.")
    with direct_vm.expect_revert("[EXPECTED] unknown_ingredient"):
        contract.forge_and_cast("fire", "void", "", "Fuse fire with a void card.")

    raw = contract._load_match(match_id)
    raw["p1_hand"] = [card for card in raw["p1_hand"] if card != "fire"] + ["fire"]
    raw["p1_hand"].append("one-man-stand")
    contract._save_match(raw)
    with direct_vm.expect_revert("[EXPECTED] ingredient_not_in_hand"):
        contract.forge_and_cast("fire", "fire", "", "Combine two copies of my fire cards.")
    with direct_vm.expect_revert("[EXPECTED] one_man_stand_requires_three_cards"):
        contract.forge_and_cast(
            "one-man-stand",
            "water",
            "",
            "Invoke the last horizon with water alone beside it.",
        )


def test_generated_spell_fields_must_be_text(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    mock_spell(
        direct_vm,
        '{"valid":true,"reason":"ok","name":17,"fusion":"Steam",'
        '"element":"steam","primary_effect":"damage",'
        '"secondary_effect":"none","description":"A pressurized steam '
        'blast surges into the opposing mage."}',
    )

    with direct_vm.expect_revert("[LLM_ERROR] fusion_fields_must_be_text"):
        contract.forge_and_cast(
            "fire",
            "water",
            "",
            "Bind fire and water into a pressurized steam blast.",
        )


def test_shield_absorption_and_automatic_turn_draw(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    mock_spell(direct_vm, WATER_WARD)
    contract.forge_and_cast(
        "water",
        "earth",
        "",
        "Bind the river into stone and raise a flowing wall around me.",
    )
    assert view_for(contract, direct_alice)["your_shield"] == 24

    direct_vm.clear_mocks()
    direct_vm.sender = direct_bob
    mock_spell(direct_vm, FIRE_DAMAGE)
    contract.forge_and_cast(
        "fire",
        "fire",
        "",
        "Converge both flames into a single brand against my enemy.",
    )
    alice = view_for(contract, direct_alice)
    bob = view_for(contract, direct_bob)

    assert alice["your_health"] == 100
    assert alice["your_shield"] == 4
    assert alice["is_your_turn"] is True
    assert len(alice["hand"]) == 11
    assert len(bob["hand"]) == 10


def test_focus_and_packs_replenish_without_exceeding_hand_limit(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    match_id = create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("[EXPECTED] hand_is_full"):
        contract.focus_turn()
    with direct_vm.expect_revert("[EXPECTED] not_enough_hand_space"):
        contract.buy_pack("standard")

    raw = contract._load_match(match_id)
    raw["p1_hand"] = raw["p1_hand"][:8]
    raw["p2_hand"] = raw["p2_hand"][:9]
    contract._save_match(raw)

    contract.focus_turn()
    alice_after_focus = view_for(contract, direct_alice)
    assert len(alice_after_focus["hand"]) == 10
    assert alice_after_focus["is_your_turn"] is False

    direct_vm.sender = direct_bob
    contract.buy_pack("standard")
    bob = view_for(contract, direct_bob)
    alice = view_for(contract, direct_alice)
    assert bob["your_gold"] == 6
    assert len(bob["hand"]) == 12
    assert len(alice["hand"]) == 11
    assert contract.get_contract_state()["total_packs"] == 1


def test_one_man_stand_is_a_three_card_mythic_fusion_with_its_downside(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    match_id = create_and_join(contract, direct_vm, direct_alice, direct_bob)
    raw = contract._load_match(match_id)
    raw["p1_health"] = 3
    raw["p2_health"] = 4
    raw["p1_hand"].remove("earth")
    raw["p1_hand"].append("one-man-stand")
    contract._save_match(raw)

    direct_vm.sender = direct_alice
    mock_spell(direct_vm, ONE_MAN_STAND)
    contract.forge_and_cast(
        "one-man-stand",
        "fire",
        "water",
        "Drag both of us onto the same final thread of life.",
    )
    alice = view_for(contract, direct_alice)
    bob = view_for(contract, direct_bob)
    assert alice["your_health"] == 10
    assert bob["your_health"] == 10
    assert alice["status"] == "active"
    assert alice["last_your_spell"]["effects"][0]["type"] == "equalize"
    assert direct_vm.run_validator() is True


def test_concession_settles_xp_and_catalog_exposes_catalyst_rarity(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_for(direct_vm, direct_deploy, direct_alice)
    create_and_join(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    contract.concede_match()

    assert view_for(contract, direct_alice)["result"] == "won"
    assert view_for(contract, direct_bob)["result"] == "lost"
    assert profile_for(contract, direct_alice)["xp"] == 10
    assert contract.get_leaderboard()["entries"] == []

    catalog = contract.get_ingredient_catalog()
    state = contract.get_contract_state()
    assert catalog["one-man-stand"]["pull_rate"] == "0.5%"
    assert catalog["shadow"]["rarity"] == "epic"
    assert state["architecture"] == "intelligent-transmutation-v3"
    assert state["starting_hand"] == 12
    assert state["single_card_casting"] is False
