# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class WhotGame(gl.Contract):
    # GenLayer strictly requires TreeMap for storage. Native dict is invalid.
    rooms: TreeMap[str, str]

    def __init__(self):
        self.rooms = TreeMap()

    @gl.public.write
    def create_room(self, room_id: str, max_players: u256, host_id: str) -> str:
        if self.rooms.get(room_id):
            return "Error: Room already exists"
            
        # Storing simple state as a formatted string to keep it GenVM compliant
        self.rooms[room_id] = f"{max_players}|{host_id}|waiting"
        return "Success: Room created"

    @gl.public.write
    def join_room(self, room_id: str, player_id: str) -> str:
        if not self.rooms.get(room_id):
            return "Error: Room not found"
            
        return "Success: Joined room"

    @gl.public.view
    def validate_move(self, played_shape: str, played_number: u256, active_shape: str, active_number: u256) -> bool:
        """Decentralized verification of Whot rules."""
        if played_shape == active_shape or played_number == active_number:
            return True
        return False