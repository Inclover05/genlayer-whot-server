# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class NaijaWhot(gl.Contract):
    def __init__(self):
        pass

    @gl.public.write
    def validate_move(self, played_shape: str, played_number: int, active_shape: str, active_number: int) -> str:
        # 1. Standard Logic Validation
        is_valid = (played_shape == active_shape) or (played_number == active_number)
        
        if not is_valid:
            return '{"isValid": false, "commentary": ""}'
            
        commentary = ""
        
        # 2. THE GENLAYER AI FEATURE
        if played_number in [1, 2, 14]:
            task_prompt = f"A player just played action card {played_number} (1=Hold On, 2=Pick Two, 14=General Market) in a game of Naija Whot. Generate exactly one short, funny Nigerian street reaction or trash talk to hype up the move."
            
            # This calls GenLayer's Intelligent LLM consensus layer
            commentary = gl.eq_principle.prompt_non_comparative(
                lambda: task_prompt,
                task="Generate a short Nigerian street reaction",
                criteria="The response must be a short text string using Nigerian pidgin or street slang."
            )
            
        # Package everything nicely into a JSON string for Node.js
        result = {
            "isValid": True,
            "commentary": commentary
        }
        return json.dumps(result)