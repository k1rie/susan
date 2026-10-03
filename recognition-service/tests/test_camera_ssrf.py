"""Guarda SSRF de camera_url (hallazgo de la revision: 100.64.0.0/10 y metadatos de Alibaba Cloud)."""
import ipaddress

import pytest

from app.camera import _blocked


@pytest.mark.parametrize('ip', ['169.254.169.254', '100.100.100.200', 'fd00:ec2::254', '0.0.0.0', '224.0.0.1', '::ffff:169.254.169.254', '::1'])
def test_siempre_bloqueadas_aun_con_camaras_privadas(ip):
    assert _blocked(ipaddress.ip_address(ip), allow_private=True)
    assert _blocked(ipaddress.ip_address(ip), allow_private=False)


@pytest.mark.parametrize('ip', ['127.0.0.1', '10.0.0.5', '192.168.1.20', '172.16.4.2', '100.64.0.1', '100.127.255.254', '::ffff:10.0.0.1'])
def test_privadas_y_cgnat_solo_con_allow_private(ip):
    assert _blocked(ipaddress.ip_address(ip), allow_private=False)
    assert not _blocked(ipaddress.ip_address(ip), allow_private=True)


@pytest.mark.parametrize('ip', ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])
def test_ip_publica_permitida(ip):
    assert not _blocked(ipaddress.ip_address(ip), allow_private=False)
