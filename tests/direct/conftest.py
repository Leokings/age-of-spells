"""Windows compatibility for genlayer-test direct-mode stdin injection.

genlayer-test 0.29.2 unlinks its temporary stdin file immediately after dup2.
POSIX permits that; Windows keeps the path locked until fd 0 is restored. This
shim retains the file until VM teardown and changes no contract behavior.
"""

from __future__ import annotations

import os
import tempfile


if os.name == "nt":
    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    _original_cleanup = VMContext._cleanup_after_deactivate

    def _windows_inject_message_to_fd0(vm: VMContext) -> None:
        from genlayer.py import calldata
        from genlayer.py.types import Address

        sender = Address(vm.sender) if isinstance(vm.sender, bytes) else vm.sender
        contract = (
            Address(vm._contract_address)
            if isinstance(vm._contract_address, bytes)
            else vm._contract_address
        )
        origin = Address(vm.origin) if isinstance(vm.origin, bytes) else vm.origin
        encoded = calldata.encode(
            {
                "contract_address": contract,
                "sender_address": sender,
                "origin_address": origin,
                "stack": [],
                "value": vm._value,
                "datetime": vm._datetime,
                "is_init": False,
                "chain_id": vm._chain_id,
                "entry_kind": 0,
                "entry_data": b"",
                "entry_stage_data": None,
            }
        )

        fd, path = tempfile.mkstemp(prefix="genlayer-direct-")
        try:
            os.write(fd, encoded)
            os.lseek(fd, 0, os.SEEK_SET)
            vm._original_stdin_fd = os.dup(0)
            os.dup2(fd, 0)
            vm._windows_stdin_temp_path = path
        finally:
            os.close(fd)

    def _windows_cleanup_after_deactivate(self: VMContext) -> None:
        path = getattr(self, "_windows_stdin_temp_path", None)
        _original_cleanup(self)
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
            self._windows_stdin_temp_path = None

    loader._inject_message_to_fd0 = _windows_inject_message_to_fd0
    VMContext._cleanup_after_deactivate = _windows_cleanup_after_deactivate
