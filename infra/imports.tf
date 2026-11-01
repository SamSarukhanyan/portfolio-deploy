# Resources created by hand in the console on 2026-10-31, adopted into Terraform.
# Safe to keep: once imported, these blocks are no-ops.

import {
  to = aws_key_pair.portfolio
  id = "portfolio-key"
}

import {
  to = aws_security_group.web
  id = "sg-09316bab528844782"
}

import {
  to = aws_instance.portfolio
  id = "i-0d3df0c9c0dbc8e1c"
}

import {
  to = aws_eip.portfolio
  id = "eipalloc-0b3d2423193d0688d"
}

import {
  to = aws_eip_association.portfolio
  id = "eipassoc-078f5fa7ca665ee7d"
}

import {
  to = aws_vpc_security_group_ingress_rule.http
  id = "sgr-0dd210afe1e0b26d4"
}

import {
  to = aws_vpc_security_group_ingress_rule.https
  id = "sgr-0fb85dba6a3478292"
}

import {
  to = aws_vpc_security_group_egress_rule.all
  id = "sgr-0e32fdf99589cd304"
}
