from typing import Annotated, Optional, Union
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel

JsonDecimal = Annotated[
    Decimal,
    PlainSerializer(
        lambda v: float(v) if v is not None else None,
        return_type=Optional[float],
        when_used="json"
    )
]

class CamelModel(BaseModel):
    """
    Base Pydantic schema configured for automatic camelCase JSON serialization/deserialization,
    matching TypeScript frontend DTO contracts while preserving snake_case in Python.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

