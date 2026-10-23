// Action: jump (dynamic, airborne). Registers in window.RobotActions['jump'].
// Each action: { duration, dynamic, update(ctx) }
//   ctx = { t, dt, progress, time, bones, robotGroup, setJumpOffset, smooth01, logSystem }
window.RobotActions = window.RobotActions || {};

window.RobotActions.jump = {
    duration: 1.2,
    dynamic: true,
    update(ctx) {
        const { t, bones, setJumpOffset, smooth01 } = ctx;
        const { torsoGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg } = bones;
        const ramp = (a, b) => smooth01((t - a) / (b - a));
        const CROUCH_END = 0.18, TAKEOFF = 0.32, LAND = 0.72;
        const DIP = 0.45, PEAK = 1.35;

        let yOff;
        if (t < CROUCH_END) {
            yOff = -DIP * ramp(0, CROUCH_END);
        } else if (t < LAND) {
            const s = (t - CROUCH_END) / (LAND - CROUCH_END);
            yOff = (PEAK + DIP) * 4 * s * (1 - s) - DIP;
        } else {
            yOff = -DIP * (1 - ramp(LAND, 1.0));
        }

        const crouchK = ramp(0, CROUCH_END);
        const extendK = 1 - ramp(CROUCH_END, TAKEOFF);
        const tuck = ramp(TAKEOFF, 0.52) * (1 - ramp(0.52, LAND));
        const absorb = ramp(LAND, 0.86) * (1 - ramp(0.86, 1.0));
        let knee;
        if (t < TAKEOFF) knee = t < CROUCH_END ? crouchK : extendK;
        else if (t < LAND) knee = tuck * 0.45;
        else knee = absorb;
        const hip = knee * 0.5 + tuck * 0.6;

        const armBack = t < CROUCH_END ? crouchK : 0;
        const armUp = tuck;
        const armFwd = absorb;
        const shoulder = armBack * 0.6 - armUp * 2.2 - armFwd * 0.5;

        leftLeg.hipPivot.rotation.x = -hip * 0.9;
        rightLeg.hipPivot.rotation.x = -hip * 0.9;
        leftLeg.kneePivot.rotation.x = knee * 1.5;
        rightLeg.kneePivot.rotation.x = knee * 1.5;
        leftLeg.footPivot.rotation.x = hip * 0.9 - knee * 1.5;
        rightLeg.footPivot.rotation.x = hip * 0.9 - knee * 1.5;

        leftArm.shoulderPivot.rotation.x = shoulder;
        rightArm.shoulderPivot.rotation.x = shoulder;
        leftArm.shoulderPivot.rotation.z = -armUp * 0.4;
        rightArm.shoulderPivot.rotation.z = armUp * 0.4;
        leftArm.elbowPivot.rotation.x = -armUp * 1.0 - armBack * 0.4;
        rightArm.elbowPivot.rotation.x = -armUp * 1.0 - armBack * 0.4;

        const drive = ramp(CROUCH_END, TAKEOFF) * (1 - ramp(TAKEOFF, 0.5));
        const crouchAmt = t < CROUCH_END ? crouchK : 0;
        torsoGroup.rotation.x = drive * 0.16 - crouchAmt * 0.14;
        headGroup.rotation.x = -drive * 0.1 + crouchAmt * 0.1;

        setJumpOffset(yOff);
    }
};
