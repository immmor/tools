// Action: combo punch (dynamic stance, no leap). Registers in window.RobotActions['punch'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.punch = {
    duration: 0.6,
    dynamic: true,
    update(ctx) {
        const { t, bones, smooth01 } = ctx;
        const { torsoGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg } = bones;
        const ramp = (a, b) => smooth01((t - a) / (b - a));
        const COCK = 0.32, THRUST = 0.58;
        const punchF = ramp(COCK, THRUST) * (1 - ramp(THRUST, 0.82));
        const cockAmt = 1 - punchF;

        // boxing stance legs
        leftLeg.hipPivot.rotation.x = -0.22;
        leftLeg.kneePivot.rotation.x = 0.45;
        leftLeg.footPivot.rotation.x = leftLeg.hipPivot.rotation.x * 0.9 - leftLeg.kneePivot.rotation.x * 1.5;
        rightLeg.hipPivot.rotation.x = -0.12;
        rightLeg.kneePivot.rotation.x = 0.32;
        rightLeg.footPivot.rotation.x = rightLeg.hipPivot.rotation.x * 0.9 - rightLeg.kneePivot.rotation.x * 1.5;

        // right arm: cross forward
        rightArm.shoulderPivot.rotation.x = -0.35 - punchF * 1.15;
        rightArm.elbowPivot.rotation.x = -1.25 * cockAmt;
        rightArm.shoulderPivot.rotation.z = 0;
        // left arm guard
        leftArm.shoulderPivot.rotation.x = -0.7;
        leftArm.elbowPivot.rotation.x = -1.0;
        leftArm.shoulderPivot.rotation.z = 0.15;

        // torso twist into the punch
        torsoGroup.rotation.y = -0.18 + punchF * 0.34;
        headGroup.rotation.y = -0.1 + punchF * 0.18;
    }
};
