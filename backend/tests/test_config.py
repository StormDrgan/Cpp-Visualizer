"""Tests for backend/config.py — module-level constants."""

import os
import tempfile

import config


class TestCompilerDefaults:
    def test_default_compiler_is_clang(self):
        assert config.COMPILER == "clang++"

    def test_compiler_flags_include_debug(self):
        assert "-g" in config.COMPILER_FLAGS
        assert "-O0" in config.COMPILER_FLAGS
        assert "-std=c++17" in config.COMPILER_FLAGS

    def test_compiler_flags_is_list(self):
        assert isinstance(config.COMPILER_FLAGS, list)
        assert len(config.COMPILER_FLAGS) >= 3


class TestExecutionLimits:
    def test_max_steps_is_positive(self):
        assert config.MAX_STEPS > 0

    def test_execution_timeout_is_positive(self):
        assert config.EXECUTION_TIMEOUT > 0

    def test_session_idle_timeout_is_positive(self):
        assert config.SESSION_IDLE_TIMEOUT > 0


class TestServerDefaults:
    def test_default_host_is_localhost(self):
        assert config.HOST == "127.0.0.1"

    def test_default_port_is_8000(self):
        assert config.PORT == 8000


class TestTempRoot:
    def test_temp_root_under_system_temp(self):
        system_tmp = tempfile.gettempdir()
        assert config.TEMP_ROOT.startswith(system_tmp)

    def test_temp_root_contains_cpp_viz(self):
        assert "cpp-viz" in config.TEMP_ROOT
