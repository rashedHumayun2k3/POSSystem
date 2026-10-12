import Svg, { Circle, Path, Rect } from "react-native-svg";

// A vector avatar stays crisp in both the compact header and the report panel.
export default function AssistantAvatar({ size = 32 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
    <Path d="M8 26V22a16 16 0 0 1 32 0v4" fill="none" stroke="#9A3412" strokeWidth={4} strokeLinecap="round"/>
    <Path d="M24 10V5" stroke="#EA580C" strokeWidth={2.5}/>
    <Circle cx={24} cy={5} r={3} fill="#FB923C"/>
    <Rect x={11} y={13} width={26} height={27} rx={10} fill="#FFF7ED" stroke="#EA580C" strokeWidth={2}/>
    <Rect x={15} y={20} width={18} height={12} rx={5} fill="#431407"/>
    <Circle cx={20} cy={25} r={2} fill="#FDBA74"/>
    <Circle cx={28} cy={25} r={2} fill="#FDBA74"/>
    <Path d="M21 35q3 3 6 0" fill="none" stroke="#EA580C" strokeWidth={2} strokeLinecap="round"/>
    <Rect x={4} y={23} width={7} height={12} rx={3.5} fill="#F97316"/>
    <Rect x={37} y={23} width={7} height={12} rx={3.5} fill="#F97316"/>
    <Path d="M40 34v3q0 5-10 5" fill="none" stroke="#9A3412" strokeWidth={2} strokeLinecap="round"/>
    <Rect x={26} y={39} width={7} height={5} rx={2.5} fill="#9A3412"/>
  </Svg>;
}
