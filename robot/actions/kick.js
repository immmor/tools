// Action: flying kick (dynamic, airborne). Registers in window.RobotActions['kick'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.kick = {
    duration: 0.95,
    dynamic: true,
    update(ctx) {
        const { t, bones, setJumpOffset, smooth01 } = ctx;
        const { torsoGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg } = bones;
        const ramp = (a, b) => smooth01((t - a) / (b - a));
        const LAUNCH = 0.30, RETRACT = 0.82;
        const DIP = 0.28, PEAK = 1.05;
        let yOff;
        if (t < LAUNCH) yOff = -DIP * ramp(0, LAUNCH);
        else if (t < RETRACT) {
            const s = (t - LAUNCH) / (RETRACT - LAUNCH);
            yOff = (PEAK + DIP) * 4 * s * (1 - s) - DIP;
        } else yOff = -DIP * (1 - ramp(RETRACT, 1.0));

        // right leg: chamber -> extend (front kick) -> chamber -> land
        const chamber = ramp(0, LAUNCH) * (1 - ramp(LAUNCH, 0.45));
        const rechamber = ramp(RETRACT, 1.0);
        const extendF = ramp(LAUNCH, 0.48) * (1 - ramp(0.54, RETRACT));
        const rKnee = (1 - extendF) * 1.5 + chamber * 0.6 + rechamber * 0.6;
        const rHip = -(0.25 + extendF * 1.15);
        rightLeg.hipPivot.rotation.x = rHip;
        rightLeg.kneePivot.rotation.x = rKnee;
        rightLeg.footPivot.rotation.x = rHip * 0.9 - rKnee * 1.5;

        // left (launch) leg: bent on takeoff, trailing in air, bent on land
        const lBend = chamber * 0.7 + rechamber * 0.8;
        leftLeg.hipPivot.rotation.x = -0.12 - lBend * 0.3;
        leftLeg.kneePivot.rotation.x = 0.25 + lBend * 0.9;
        leftLeg.footPivot.rotation.x = leftLeg.hipPivot.rotation.x * 0.9 - leftLeg.kneePivot.rotation.x * 1.5;

        // arms: guard up, one hand back for balance
        const guard = 0.4 + extendF * 0.3;
        leftArm.shoulderPivot.rotation.x = -1.3 * guard;
        leftArm.elbowPivot.rotation.x = -0.9 * guard;
        leftArm.shoulderPivot.rotation.z = -0.2;
        rightArm.shoulderPivot.rotation.x = -1.1 * guard;
        rightArm.elbowPivot.rotation.x = -1.0 * guard;
        rightArm.shoulderPivot.rotation.z = 0.25;

        torsoGroup.rotation.x = -extendF * 0.28;
        headGroup.rotation.x = extendF * 0.12;

        setJumpOffset(yOff);
    }
};
