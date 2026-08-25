from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded


ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def test_intelligent_transmutation_accepts_projectile_spell_on_studionet():
    creator, challenger = create_accounts(2)
    factory = get_contract_factory("AgeOfSpellsPvP")
    contract = factory.deploy(args=[], account=creator)
    challenger_contract = contract.connect(challenger)
    print(
        f"Studionet AgeOfSpellsPvP contract: {contract.address}; "
        f"creator: {creator.address}; challenger: {challenger.address}"
    )

    create_receipt = contract.create_match(args=[ZERO_ADDRESS]).transact()
    assert tx_execution_succeeded(create_receipt)

    waiting = contract.get_player_match(args=[creator.address]).call()
    assert waiting["status"] == "waiting"
    assert waiting["creator"].lower() == creator.address.lower()
    assert waiting["invited_player"] == ZERO_ADDRESS

    lobby = challenger_contract.get_lobby(args=[challenger.address]).call()
    assert len(lobby["matches"]) == 1
    assert lobby["matches"][0]["match_id"] == waiting["match_id"]

    join_receipt = challenger_contract.join_match(
        args=[waiting["match_id"]]
    ).transact()
    assert tx_execution_succeeded(join_receipt)

    creator_view = contract.get_player_match(args=[creator.address]).call()
    challenger_view = challenger_contract.get_player_match(
        args=[challenger.address]
    ).call()
    assert creator_view["status"] == "active"
    assert challenger_view["status"] == "active"
    assert creator_view["opponent"].lower() == challenger.address.lower()
    assert challenger_view["opponent"].lower() == creator.address.lower()
    assert creator_view["is_your_turn"] is True
    assert challenger_view["is_your_turn"] is False
    assert len(creator_view["hand"]) == 12
    assert len(challenger_view["hand"]) == 12
    for ingredient in ("fire", "water", "air", "earth"):
        assert creator_view["hand"].count(ingredient) == 3
        assert challenger_view["hand"].count(ingredient) == 3

    # This exact, valid intent previously ended as MAJORITY_DISAGREE because
    # validators chose different creative labels for the same offensive spell.
    incantation = (
        "i compress air and rock into high speed projectiles while flying "
        "around"
    )
    forge_receipt = contract.forge_and_cast(
        args=["air", "air", "earth", incantation]
    ).transact()
    assert tx_execution_succeeded(forge_receipt)

    forged_view = contract.get_player_match(args=[creator.address]).call()
    challenger_after = challenger_contract.get_player_match(
        args=[challenger.address]
    ).call()
    spell = forged_view["last_your_spell"]

    assert len(forged_view["hand"]) == 9
    assert forged_view["is_your_turn"] is False
    assert challenger_after["is_your_turn"] is True
    assert challenger_after["your_health"] in (72, 80)
    assert spell == challenger_after["last_opponent_spell"]
    assert forged_view["spell_history"] == [spell]
    assert spell["tier"] == "grand"
    assert spell["ingredients"] == ["air", "air", "earth"]
    assert spell["incantation"] == incantation
    assert spell["primary_effect"] in ("damage", "piercing")
    assert spell["effects"][0]["type"] in ("damage", "piercing")
    assert spell["effects"][0]["target"] == "enemy"

    state = contract.get_contract_state().call()
    assert state["architecture"] == "intelligent-transmutation-v3"
    assert state["starting_hand"] == 12
    assert state["single_card_casting"] is False
    assert state["total_fusions"] == 1
    print(
        f"Studionet intelligent transmutation verified: {contract.address}; "
        f"forged {spell['name']} ({spell['fusion']}, {spell['primary_effect']})"
    )
