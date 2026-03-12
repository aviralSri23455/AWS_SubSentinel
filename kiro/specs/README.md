# Kiro Specs Directory

This directory contains EARS (Easy Approach to Requirements Specification) compliant specifications for Kiro Autopilot.

## Structure

- `specs/` - EARS-compliant requirement specifications
- `steering/` - Kiro steering files for Autopilot
- `templates/` - Code and test templates
- `workflows/` - Development workflows and automation

## Spec Structure

Each spec should follow the EARS format:
- **Title**: Clear, concise title
- **Description**: What the feature does
- **Triggers**: Events that initiate the feature
- **Preconditions**: System state before execution
- **Postconditions**: Expected state after execution
- **Exceptions**: Error conditions and handling
- **Acceptance Criteria**: How to verify the feature works

## Usage

1. Create specs in `specs/` directory
2. Use Kiro Autopilot to generate code from specs
3. Run `kiro autopilot run` to execute workflows